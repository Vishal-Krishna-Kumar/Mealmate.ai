"""LLM-backed recipe generator + Wikipedia image lookup.

When the user asks the assistant to schedule a dish that doesn't exist in
the MongoDB recipe library, the Node server calls
``POST /recipes/generate`` to have Gemini draft a full structured recipe.
The result is then saved to the DB and added to the user's plan in a
single round-trip.

Best-effort image lookup pulls the lead thumbnail from Wikipedia
(no API key required) so the generated recipe card has a real photo.
"""

from __future__ import annotations

import logging
import urllib.parse
import urllib.request
from typing import Any

from pydantic import ValidationError

from . import gemini
from .schemas import (
    GenerateRecipeRequest,
    GenerateRecipeResponse,
    GeneratedRecipe,
)

logger = logging.getLogger(__name__)


_RECIPE_PROMPT_TEMPLATE = """\
You are a professional chef creating a recipe for the MealMate app.

Generate a complete, REALISTIC recipe for the dish requested below. The
recipe should be authentic to its cuisine, achievable in a home kitchen,
and lean toward the healthier preparation of that dish (less oil/fat,
more vegetables, lean proteins, whole grains) without sacrificing the
characteristic flavour.

Requested dish: {query}

User dietary preferences: {dietary_preferences}
User allergies (NEVER include these or anything that contains them): {allergies}

OUTPUT FORMAT — return a single JSON object (no code fences, no prose
outside the JSON) with these exact keys:

{{
  "title": "<canonical dish name, e.g. 'Chicken Biryani'>",
  "description": "<one to three sentences>",
  "cuisine": "<single word like 'indian', 'italian', 'mexican'>",
  "tags": ["<3-6 short tags like 'indian','dinner','high-protein'>"],
  "ingredients": [
    {{"name": "<lowercase ingredient>", "quantity": <number>, "unit": "<g|ml|cup|tbsp|tsp|piece>"}}
  ],
  "instructions": ["<step 1>", "<step 2>", "..."],
  "prep_time": <integer minutes>,
  "cook_time": <integer minutes>,
  "servings": <integer 2-6>,
  "nutrition": {{
    "calories": <kcal per serving>,
    "protein": <g per serving>,
    "carbs": <g per serving>,
    "fat": <g per serving>,
    "fiber": <g per serving>,
    "sugar": <g per serving>,
    "sodium": <mg per serving>
  }},
  "difficulty": "easy|medium|hard"
}}

Rules:
- Provide between 6 and 20 ingredients.
- Provide between 4 and 12 instruction steps.
- Use integer minutes for prep_time / cook_time.
- Nutrition values must be best-effort estimates per serving.
- If the user has allergies, swap conflicting ingredients with safe equivalents
  and reflect that in the title (e.g. 'Dairy-Free Chicken Biryani').
- If the dietary preferences include 'vegetarian' or 'vegan', the recipe MUST
  comply (no meat / no animal products respectively).
"""


def _build_prompt(req: GenerateRecipeRequest) -> str:
    return _RECIPE_PROMPT_TEMPLATE.format(
        query=req.query.strip(),
        dietary_preferences=", ".join(req.dietary_preferences) or "(none)",
        allergies=", ".join(req.allergies) or "(none)",
    )


def _fetch_wikipedia_image(query: str) -> str | None:
    """Best-effort lead-thumbnail lookup. Returns a direct image URL or None.

    Uses the public MediaWiki API (no key, no rate-limit headache for low
    volume) with ``generator=search`` + ``prop=pageimages`` to fetch the
    page image of the most relevant article in a single call.

    We require the matched article's title to share at least one
    non-stopword token (>= 4 chars) with the query. Without this guard,
    fuzzy MediaWiki search happily returns unrelated photos for
    niche / AI-coined dish names (e.g. it returns a paprika photo for
    "Spicy Indian Lobster Masala").
    """
    if not query.strip():
        return None
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"{query.strip()} dish",
        "gsrlimit": "1",
        "prop": "pageimages",
        "piprop": "thumbnail|original",
        "pithumbsize": "600",
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "MealMate/0.1 (educational; contact: dev@local)"}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data: dict[str, Any] = __import__("json").loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover - network path
        logger.debug("wikipedia image lookup failed for %r: %s", query, exc)
        return None

    # Build the set of meaningful query tokens we'll compare the article
    # title against.
    query_tokens = {
        t for t in query.lower().split() if len(t) >= 4 and t.isalpha()
    }
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        title = str(page.get("title") or "").lower()
        title_tokens = {t.strip(",.()") for t in title.split() if len(t) >= 4}
        # Reject obviously off-topic results when we have query tokens to
        # check against. If the query was pure stopwords/short words, we
        # accept whatever Wikipedia returned.
        if query_tokens and not (query_tokens & title_tokens):
            logger.debug(
                "wikipedia image rejected: query=%r article=%r", query, title
            )
            continue
        thumb = page.get("thumbnail") or {}
        if thumb.get("source"):
            return str(thumb["source"])
        orig = page.get("original") or {}
        if orig.get("source"):
            return str(orig["source"])
    return None


def _pollinations_image_url(query: str) -> str | None:
    """Always-available fallback that returns a Pollinations.AI text-to-image URL.

    Pollinations exposes a free, key-less endpoint at
    ``https://image.pollinations.ai/prompt/<encoded prompt>`` that returns a
    generated image directly. We use it when the user asks for an unusual
    dish that Wikipedia doesn't index (e.g. ``Spicy Indian Lobster Masala``)
    so the generated recipe card still has a real visual.

    The URL is constructed deterministically (no HTTP call from our side)
    so this never fails or blocks; if the upstream is down the client just
    falls back to its placeholder image.
    """
    q = query.strip()
    if not q:
        return None
    prompt = f"{q}, food photography, professional plating, top down, natural light"
    encoded = urllib.parse.quote(prompt, safe="")
    # ``nologo=true`` removes the Pollinations watermark.
    # ``seed`` is derived from the query so the same dish always gets the
    # same image across requests (stable caching, predictable UX).
    seed = abs(hash(q.lower())) % 100_000
    return (
        "https://image.pollinations.ai/prompt/"
        f"{encoded}?width=600&height=400&nologo=true&seed={seed}"
    )


def _violates_allergy(recipe: GeneratedRecipe, allergies: list[str]) -> str | None:
    """Return the first allergen substring found in any ingredient name, else None."""
    if not allergies:
        return None
    haystack = " ".join(i.name.lower() for i in recipe.ingredients)
    for a in allergies:
        token = a.strip().lower()
        if token and token in haystack:
            return a
    return None


def generate(req: GenerateRecipeRequest) -> GenerateRecipeResponse:
    """Generate a recipe from a freeform user query.

    Returns ``strategy='unavailable'`` when Gemini isn't configured.
    Returns ``strategy='llm'`` with ``recipe=None`` + a message when the
    model fails or the result violates the user's allergies.
    """
    if not gemini.is_available():
        return GenerateRecipeResponse(
            success=False,
            strategy="unavailable",
            message="Recipe generator requires GEMINI_API_KEY.",
        )

    prompt = _build_prompt(req)
    text = gemini.generate_text(
        system="You are a professional chef. Respond with valid JSON only.",
        user=prompt,
        json_mode=True,
        temperature=0.4,
    )
    if not text:
        return GenerateRecipeResponse(
            success=False, strategy="llm", message="Model returned no content."
        )

    payload = gemini.parse_json(text)
    if not isinstance(payload, dict):
        return GenerateRecipeResponse(
            success=False, strategy="llm", message="Model returned unparseable JSON."
        )

    try:
        recipe = GeneratedRecipe.model_validate(payload)
    except ValidationError as exc:
        logger.debug("recipe validation failed: %s", exc)
        return GenerateRecipeResponse(
            success=False,
            strategy="llm",
            message="Model output didn't match the recipe schema.",
        )

    bad = _violates_allergy(recipe, req.allergies)
    if bad:
        return GenerateRecipeResponse(
            success=False,
            strategy="llm",
            message=f"Generated recipe contained allergen '{bad}'; refusing to save.",
        )

    # Image lookup is best-effort and never blocks saving the recipe.
    # Try Wikipedia first (real photos of real-world dishes); if no hit,
    # fall back to a Pollinations.AI generated image so AI-coined or
    # niche dishes still have a relevant visual.
    img = (
        _fetch_wikipedia_image(recipe.title)
        or _fetch_wikipedia_image(req.query)
        or _pollinations_image_url(recipe.title)
        or _pollinations_image_url(req.query)
    )
    if img:
        recipe.image_url = img

    return GenerateRecipeResponse(success=True, strategy="llm", recipe=recipe)
