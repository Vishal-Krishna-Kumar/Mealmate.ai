"""Vision-based pantry capture.

Accepts an image (bytes or base64) of a fridge / pantry / countertop and
returns a structured list of recognised ingredients. The Gemini multimodal
model handles the OCR + visual recognition; we then post-process the response
into the same ``ParsedPantryItem`` schema that the text-based pantry parser
emits, so downstream UI is unchanged.

When ``GEMINI_API_KEY`` is unset (or the SDK is unavailable), the function
returns ``None`` so the route can respond with a graceful 503 rather than a
500. The route layer surfaces a friendly "vision unavailable" message.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
from typing import Any

from . import gemini
from .cache import get_cache, make_key
from .metrics import record_llm_call
from .schemas import ParsedPantryItem


_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic"}
_MAX_BYTES = 6 * 1024 * 1024  # 6 MB to fit Gemini inline limits


def _decode(image_b64: str) -> tuple[bytes, str] | None:
    """Return ``(raw_bytes, mime)`` from a base64 string, or ``None`` on bad input."""
    s = image_b64.strip()
    mime = "image/jpeg"
    m = re.match(r"^data:(image/[a-zA-Z+0-9.-]+);base64,(.*)$", s, re.DOTALL)
    if m:
        mime = m.group(1).lower()
        s = m.group(2)
    if mime not in _ALLOWED_MIME:
        return None
    try:
        data = base64.b64decode(s, validate=True)
    except (binascii.Error, ValueError):
        return None
    if not data or len(data) > _MAX_BYTES:
        return None
    return data, mime


def _vision_model_name() -> str:
    import os

    return os.environ.get("GEMINI_VISION_MODEL") or gemini._model_name()


def _call_gemini_vision_uncached(
    data: bytes, mime: str, hint: str | None
) -> list[dict[str, Any]] | None:
    try:
        import google.generativeai as genai  # type: ignore[import-not-found]
    except ImportError:
        record_llm_call("vision_pantry", "sdk_missing")
        return None

    if not gemini.is_available():
        record_llm_call("vision_pantry", "no_key")
        return None

    try:
        genai.configure(api_key=__import__("os").environ["GEMINI_API_KEY"])
    except Exception:  # pragma: no cover - defensive
        record_llm_call("vision_pantry", "configure_failed")
        return None

    system = (
        "You are MealMate's vision pantry assistant. Identify every food item "
        "visible in the user's photo. For each item, output a JSON object with: "
        "ingredient (lowercase common name), quantity (string like '2' or '0.5' or null), "
        "unit (string like 'lb', 'g', 'cup', 'item' or null), and confidence (0-1). "
        "Group multiple of the same item into one entry. Ignore non-food items, "
        "packaging branding and background clutter. Respond with a JSON array "
        "(not wrapped in an object). When unsure, lower the confidence rather "
        "than omitting the item."
    )
    user_prompt: list[Any] = [
        {"mime_type": mime, "data": data},
        system,
    ]
    if hint:
        user_prompt.append(f"Additional context from the user: {hint[:500]}")
    try:
        model = genai.GenerativeModel(model_name=_vision_model_name())
        resp = model.generate_content(
            user_prompt,
            generation_config={
                "temperature": 0.2,
                "response_mime_type": "application/json",
            },
        )
    except Exception:
        record_llm_call("vision_pantry", "api_error")
        return None

    text = getattr(resp, "text", None)
    if not text:
        try:
            text = resp.candidates[0].content.parts[0].text  # type: ignore[index]
        except Exception:
            record_llm_call("vision_pantry", "empty_response")
            return None

    data_obj = gemini.parse_json(text)
    if isinstance(data_obj, dict):
        # Some models wrap arrays in an object.
        for key in ("items", "ingredients", "results"):
            if key in data_obj and isinstance(data_obj[key], list):
                data_obj = data_obj[key]
                break
    if not isinstance(data_obj, list):
        record_llm_call("vision_pantry", "bad_shape")
        return None
    record_llm_call("vision_pantry", "ok")
    return data_obj  # type: ignore[return-value]


def _call_gemini_vision(image_b64: str, hint: str | None) -> list[dict[str, Any]] | None:
    decoded = _decode(image_b64)
    if decoded is None:
        return None
    data, mime = decoded

    # The raw image bytes are far too big to JSON-serialise into a cache key,
    # so we fingerprint them with SHA-256 and use that as the cache discriminator.
    fingerprint = hashlib.sha256(data).hexdigest()
    cache = get_cache("vision_pantry")
    key = make_key("vision", fingerprint, mime, hint)
    cached = cache.get(key)
    if cached is not None:
        return cached  # type: ignore[no-any-return]

    result = _call_gemini_vision_uncached(data, mime, hint)
    if result is not None:
        cache.set(key, result)
    return result


def parse_image(image_b64: str, hint: str | None = None) -> list[ParsedPantryItem] | None:
    """Return parsed pantry items, or ``None`` when vision is unavailable / failed."""
    raw = _call_gemini_vision(image_b64, hint)
    if raw is None:
        return None

    items: list[ParsedPantryItem] = []
    seen: set[str] = set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("ingredient", "")).strip().lower()
        if not name or name in seen:
            continue
        seen.add(name)
        qty_raw = entry.get("quantity")
        unit_raw = entry.get("unit")
        quantity = str(qty_raw).strip() if qty_raw not in (None, "", "null") else None
        unit = str(unit_raw).strip() if unit_raw not in (None, "", "null") else None
        items.append(ParsedPantryItem(ingredient=name, quantity=quantity, unit=unit))
    return items
