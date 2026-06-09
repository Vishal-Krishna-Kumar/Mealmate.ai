"""Cooking-assistant chat — Gemini-backed with a graceful no-key fallback.

The route is stateless: the client always sends the full conversation. We add
a system prompt with the user's pantry / preferences / allergies (and an
optional recipe context block) so the model can ground its answers.

When the model wants to mutate user data (e.g. add a recipe to the weekly
plan) it returns a structured ``actions`` array alongside its reply. The Node
server interprets and applies each action against MongoDB and surfaces the
result (resolved recipe, calories, ingredients) back to the client.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from . import gemini
from .schemas import (
    AddToPlanAction,
    ChatAction,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatSuggestion,
)


_DEFAULT_SUGGESTIONS = [
    ChatSuggestion(label="Suggest a 30-min dinner", prompt="Suggest a 30-minute dinner I can make with what's in my pantry."),
    ChatSuggestion(label="Substitute an ingredient", prompt="What can I substitute for buttermilk?"),
    ChatSuggestion(label="Scale this recipe", prompt="How do I scale this recipe to 6 servings?"),
    ChatSuggestion(label="Make it healthier", prompt="How can I make this recipe healthier without losing flavour?"),
]


_ACTION_GUIDE = """\
TOOL — add_to_plan
You can place recipes onto the user's weekly meal plan by emitting an entry
in the JSON "actions" array. Each entry must look like:
    {"type": "add_to_plan",
     "recipe_query": "<dish name as the user said it>",
     "day": "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",
     "slot": "breakfast|lunch|dinner",
     "week_offset": 0,
     "target_date": "YYYY-MM-DD"   // OPTIONAL — see below
    }

Rules:
- week_offset 0 = the week that contains TODAY (Mon-Sun). 1 = the FOLLOWING
  Mon-Sun week. Use 0 unless the user explicitly says "next week" or names a
  day that has already passed this week.
- If the user says "next Sunday" and today IS Sunday, use day=Sunday with
  week_offset=1. If today is Monday-Saturday, "next Sunday" means this week's
  Sunday (week_offset=0).
- TIME → SLOT mapping: morning / breakfast / before 11am → breakfast.
  noon / lunch / midday / 11am-2pm → lunch. evening / dinner / supper /
  after 5pm → dinner. If unsure, default to dinner.

DATE HANDLING — CRITICAL:
When the user names an EXPLICIT calendar date (any of these patterns):
    - "june 4", "jun 4", "June 4th", "4 June"
    - "6/4", "06/04", "6/4/2026"
    - "2026-06-04"
    - "tomorrow", "today", "day after tomorrow"
you MUST:
    1. Resolve it to an absolute YYYY-MM-DD using the "Today is ..." date
       given in this prompt. If the user wrote just "june 4" with no year,
       assume the NEXT occurrence of that month/day (i.e. this year if it's
       still in the future, otherwise next year).
    2. Set "target_date" to that ISO date.
    3. ALSO fill day + week_offset to match (best-effort) — but the server
       will recompute them from target_date as the source of truth, so it's
       fine if you're off by one.

Examples (assume today is Tue 2026-05-26):
    User: "add chicken cashew for june 4 morning"
        target_date = "2026-06-04"  (Thursday of NEXT week)
        day = Thursday, slot = breakfast, week_offset = 1
    User: "put salmon on Thursday lunch"  (no explicit date)
        target_date = null (omit field)
        day = Thursday, slot = lunch, week_offset = 0
    User: "tofu stir fry tomorrow dinner"
        target_date = "2026-05-27"  (Wednesday this week)
        day = Wednesday, slot = dinner, week_offset = 0

Recipe-query rules — IMPORTANT:
- recipe_query MUST be a SPECIFIC dish name (1-6 words). If the user names a
  GENERIC family of dishes that has many common variants (e.g. just "biryani",
  "curry", "pasta", "soup", "stir fry", "salad" with no qualifier), DO NOT
  emit an action yet. Instead ask ONE concise clarifying question covering
  the missing variant + protein/style. Examples:
    User: "add biryani to Sunday dinner"
    You: ask "Chicken, lamb, or vegetable biryani? And what spice level
          — mild, medium, or spicy?" (no actions in this turn)
    User: "vegetable biryani, medium spice"
    You: emit action with recipe_query="vegetable biryani medium spice"
         and confirm in plain text.
- If the user already gave a specific name ("chicken biryani", "thai green
  curry", "spaghetti carbonara") DO NOT ask — emit the action directly.
- recipe_query should preserve the exact dish phrasing the user provided.
  Do NOT substitute one variant for another. For example, if the user says
  "add hamburger", do not emit recipe_query="turkey burger" or any other
  variant; emit "hamburger" instead.
- Honour the user's known dietary preferences and allergies when picking the
  default variant in your clarifying question (e.g. if they're vegetarian,
  offer vegetable / paneer options first).
- The server may generate the recipe with AI if the library doesn't have it,
  so it's fine to emit a query for any reasonable dish — your "reply" should
  set expectations: e.g. "Adding vegetable biryani to Sunday dinner. I'll
  draft the recipe if it's not already in your library."
- Only emit actions the user explicitly asked for. Don't volunteer them.
"""


def _build_system_prompt(req: ChatRequest) -> str:
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%A, %Y-%m-%d")
    parts = [
        "You are MealMate's friendly cooking assistant. You help users plan "
        "meals, substitute ingredients, scale recipes, decode techniques, and "
        "suggest dishes that fit their pantry and dietary needs. Be concise "
        "(<= 6 sentences unless the user asks for detail). Use plain text "
        "(no markdown headings); short bullet lists are fine. If the user "
        "asks for something unsafe (raw chicken, expired food, etc.), warn "
        "them clearly. Never invent nutrition numbers — if asked for exact "
        "macros, suggest using the Nutrition page.",
        f"Today is {today_str} (UTC). Use this to resolve relative dates.",
        _ACTION_GUIDE,
        (
            "OUTPUT FORMAT — IMPORTANT. Always respond with a single JSON "
            'object: {"reply": "<plain text>", "actions": [<zero or more '
            "action objects as defined above>]}. Do NOT wrap the JSON in code "
            "fences. Do NOT include any prose outside the JSON. If you have "
            'no actions, return an empty array: "actions": [].'
        ),
    ]
    if req.pantry:
        parts.append(f"User pantry: {', '.join(req.pantry[:40])}.")
    if req.dietary_preferences:
        parts.append(f"Dietary preferences: {', '.join(req.dietary_preferences)}.")
    if req.allergies:
        parts.append(
            f"ALLERGIES (NEVER suggest these or anything that contains them): "
            f"{', '.join(req.allergies)}."
        )
    if req.recipe_context:
        parts.append(f"Active recipe context:\n{req.recipe_context[:2000]}")
    return "\n\n".join(parts)


def _suggest_followups(reply: str) -> list[ChatSuggestion]:
    """Heuristic follow-up chips so the UI always feels alive."""
    lower = reply.lower()
    pool: list[ChatSuggestion] = []
    if "substitut" in lower:
        pool.append(ChatSuggestion(label="Why does that work?", prompt="Why does that substitution work chemically?"))
    if "minute" in lower or "min" in lower:
        pool.append(ChatSuggestion(label="Make it faster", prompt="Can you make that even faster?"))
    if "vegan" in lower or "vegetarian" in lower:
        pool.append(ChatSuggestion(label="Add protein", prompt="How do I add more plant protein to that?"))
    pool.extend(
        [
            ChatSuggestion(label="Pair with a side", prompt="What's a good side dish to pair with that?"),
            ChatSuggestion(label="Wine / drink pairing", prompt="What drink would you pair with that?"),
        ]
    )
    return pool[:3]


def _fallback_reply(req: ChatRequest) -> str:
    """When Gemini isn't configured, give a useful canned answer."""
    last = req.messages[-1].content if req.messages else ""
    bits = [
        "I'm MealMate's offline assistant — the live AI model isn't configured "
        "(set `GEMINI_API_KEY` on the AI service to enable it).",
    ]
    if req.pantry:
        bits.append(
            f"Based on your pantry ({', '.join(req.pantry[:6])}), you could try "
            "the recipes shown on the *Recipes* page — sorted by relevance to "
            "what you have."
        )
    if last:
        bits.append(f"You asked: \"{last[:140]}\". Once the API key is set, I can answer that directly.")
    return " ".join(bits)


def _model_error_reply(req: ChatRequest) -> str:
    """When Gemini IS configured but the call returned nothing (transient failure).

    This is different from the no-key path — telling the user to "set the API
    key" when the key is already set is misleading and confusing. Common
    causes: safety filter triggered on the user's input, intermittent
    upstream timeout, prompt token-limit overrun, or a compound request the
    model declined to fulfil in one shot.
    """
    last = req.messages[-1].content if req.messages else ""
    bits = [
        "I had trouble getting a response from the AI model just now — it "
        "came back empty.",
        "This usually clears up if you try again or rephrase. If your "
        "request had multiple parts (e.g. \"add salad AND nutella bread\"), "
        "try asking for one thing at a time.",
    ]
    if last:
        bits.append(f"(Your message: \"{last[:140]}\")")
    return " ".join(bits)


def _quota_error_reply(req: ChatRequest, exc: gemini.GeminiQuotaError) -> str:
    """Honest, actionable message when the Gemini API quota has been exhausted.

    Free-tier Gemini caps daily requests per model (e.g. 20/day for
    ``gemini-2.5-flash``). When that ceiling is hit, the SDK raises
    ``ResourceExhausted`` and *no* amount of rephrasing will help — telling
    the user otherwise is misleading. Surface the real cause and a precise
    retry window so they know whether to wait or upgrade their plan.
    """
    last = req.messages[-1].content if req.messages else ""
    bits = [
        "The AI assistant is temporarily unavailable because the Gemini API "
        f"daily quota for model `{exc.model}` has been reached.",
    ]
    if exc.retry_after is not None:
        # Round up to whole seconds; if it's a large window, express in min.
        secs = max(1, int(exc.retry_after))
        if secs >= 60:
            mins = (secs + 59) // 60
            bits.append(f"Please retry in about {mins} minute{'s' if mins != 1 else ''}.")
        else:
            bits.append(f"Please retry in about {secs} second{'s' if secs != 1 else ''}.")
    else:
        bits.append(
            "The free-tier daily quota resets every 24 hours — try again "
            "later, or enable billing on your Google AI Studio project for a "
            "higher limit."
        )
    bits.append(
        "Meanwhile you can still browse recipes, edit the planner manually, "
        "and generate grocery lists — those features don't need the AI."
    )
    if last:
        bits.append(f"(Your message: \"{last[:140]}\")")
    return " ".join(bits)


def _coerce_actions(raw: Any) -> list[ChatAction]:
    """Best-effort: turn whatever the LLM gave us into validated ChatAction objects."""
    if not isinstance(raw, list):
        return []
    out: list[ChatAction] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        action_type = item.get("type")
        try:
            if action_type == "add_to_plan":
                out.append(AddToPlanAction.model_validate(item))
            # Future action types plug in here.
        except ValidationError:
            continue
    return out


def reply(req: ChatRequest) -> ChatResponse:
    if not req.messages:
        return ChatResponse(reply="Ask me anything!", strategy="fallback", suggestions=_DEFAULT_SUGGESTIONS)

    if not gemini.is_available():
        return ChatResponse(
            reply=_fallback_reply(req),
            strategy="fallback",
            suggestions=_DEFAULT_SUGGESTIONS,
        )

    system = _build_system_prompt(req)
    history = [
        {"role": m.role, "content": m.content} for m in req.messages[:-1]
    ]
    last_user = req.messages[-1].content
    try:
        text = gemini.generate_chat(
            system=system,
            history=history,
            user_message=last_user,
            json_mode=True,
        )
    except gemini.GeminiQuotaError as quota_exc:
        # Free-tier daily quota burnt out (or rate-limit window hit). Show a
        # honest, actionable message instead of the generic "try rephrasing"
        # fallback, which would have the user blaming themselves for an
        # upstream billing limit.
        return ChatResponse(
            reply=_quota_error_reply(req, quota_exc),
            strategy="fallback",
            suggestions=_DEFAULT_SUGGESTIONS,
        )
    if not text:
        return ChatResponse(
            reply=_model_error_reply(req),
            strategy="fallback",
            suggestions=_DEFAULT_SUGGESTIONS,
        )

    parsed = gemini.parse_json(text)
    if isinstance(parsed, dict):
        reply_text = str(parsed.get("reply") or "").strip()
        actions = _coerce_actions(parsed.get("actions"))
    else:
        # Model ignored the JSON contract — fall back to using the raw text.
        reply_text = text.strip()
        actions = []

    if not reply_text:
        reply_text = "Done."

    return ChatResponse(
        reply=reply_text,
        strategy="llm",
        suggestions=_suggest_followups(reply_text),
        actions=actions,
    )


# Re-exported for tests.
__all__ = ["reply", "ChatMessage"]
