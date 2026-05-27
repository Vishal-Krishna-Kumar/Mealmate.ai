"""Shared types and text helpers used by the recommender, planner, sustainability
and evaluation modules.

Extracted into its own module to break the circular import between
:py:mod:`app.recommender` and :py:mod:`app.collab` / :py:mod:`app.sustainability`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Recipe:
    """In-memory recipe row used by every AI-service module."""

    recipe_id: str
    title: str
    ingredients: tuple[str, ...]
    tags: tuple[str, ...]
    cuisine: str | None


def normalize(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower()).strip()


def normalize_list(items: Iterable[str]) -> list[str]:
    """Normalise and dedupe a list of strings, preserving first-seen order."""
    seen: set[str] = set()
    out: list[str] = []
    for it in items:
        n = normalize(it)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def doc_text(recipe: Recipe) -> str:
    """Build the bag-of-words document representing a recipe (used for TF-IDF / LSA)."""
    parts: list[str] = [normalize(recipe.title)]
    parts.extend(normalize(i) for i in recipe.ingredients)
    parts.extend(normalize(i) for i in recipe.ingredients)  # double-weight ingredients
    parts.extend(normalize(t) for t in recipe.tags)
    if recipe.cuisine:
        parts.append(normalize(recipe.cuisine))
    return " ".join(p for p in parts if p)


def query_text(ingredients: list[str], dietary_preferences: list[str]) -> str:
    """Build the bag-of-words document representing a user query."""
    return " ".join(normalize_list(ingredients) + normalize_list(dietary_preferences))
