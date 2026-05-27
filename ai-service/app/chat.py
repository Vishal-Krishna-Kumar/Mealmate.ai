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
     "week_offset": 0}

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
    text = gemini.generate_chat(
        system=system,
        history=history,
        user_message=last_user,
        json_mode=True,
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
