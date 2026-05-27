"""Sustainability scoring for recipes.

Computes per-recipe **CO2-equivalent emissions (kg)**, **estimated cost (USD)**
and a normalised **eco score (0-1, higher is greener)** by joining each recipe's
ingredient list against a curated lookup table sourced from peer-reviewed
emission datasets (Poore & Nemecek 2018; Our World in Data, 2023).

This module is intentionally dependency-light (pure stdlib + numpy) so it stays
fast and works offline. Unknown ingredients fall back to a sensible "pantry
default" so a missing entry never breaks the pipeline.

Returned per-recipe footprint values are *per serving*: each ingredient is
assumed to contribute ``default_serving_kg`` (~100 g) of edible mass unless
the metadata overrides it. This keeps the planner's weekly aggregation
plausible without requiring per-recipe gram-level quantities.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from ._text import Recipe, normalize

METADATA_PATH = Path(__file__).resolve().parent.parent / "data" / "ingredient_metadata.json"


@dataclass(frozen=True)
class IngredientFootprint:
    name: str
    category: str
    co2_kg: float
    cost_usd: float


@dataclass(frozen=True)
class RecipeFootprint:
    recipe_id: str
    co2_kg: float
    cost_usd: float
    eco_score: float  # 0.0 (worst) .. 1.0 (best)
    breakdown: tuple[IngredientFootprint, ...]
    categories: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "recipe_id": self.recipe_id,
            "co2_kg": round(self.co2_kg, 3),
            "cost_usd": round(self.cost_usd, 2),
            "eco_score": round(self.eco_score, 3),
            "categories": list(self.categories),
            "breakdown": [
                {
                    "name": item.name,
                    "category": item.category,
                    "co2_kg": round(item.co2_kg, 3),
                    "cost_usd": round(item.cost_usd, 2),
                }
                for item in self.breakdown
            ],
        }


@lru_cache(maxsize=1)
def _load_metadata() -> dict[str, object]:
    with METADATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _lookup_ingredient(name: str) -> tuple[str, float, float, float]:
    """Return ``(category, co2_kg_per_kg, cost_usd_per_kg, serving_kg)``."""
    meta = _load_metadata()
    defaults = meta["defaults"]  # type: ignore[index]
    ingredients: dict[str, dict] = meta["ingredients"]  # type: ignore[assignment,index]
    categories: dict[str, dict] = meta["categories"]  # type: ignore[assignment,index]

    norm = normalize(name)

    entry = ingredients.get(norm)
    if entry is None:
        # Try a more forgiving match: substring contains.
        for key, value in ingredients.items():
            if key in norm or norm in key:
                entry = value
                break

    if entry is None:
        return (
            str(defaults["category"]),
            float(defaults["co2_kg_per_kg"]),
            float(defaults["cost_usd_per_kg"]),
            float(defaults["default_serving_kg"]),
        )

    category = str(entry.get("category", defaults["category"]))
    cat_defaults = categories.get(category, {})
    co2 = float(entry.get("co2_kg_per_kg", cat_defaults.get("co2_kg_per_kg", defaults["co2_kg_per_kg"])))
    cost = float(entry.get("cost_usd_per_kg", cat_defaults.get("cost_usd_per_kg", defaults["cost_usd_per_kg"])))
    serving = float(entry.get("default_serving_kg", defaults["default_serving_kg"]))
    return category, co2, cost, serving


# Reference per-serving footprint range for the bundled corpus. Used to
# normalise into a 0-1 eco score. Values calibrated so an all-vegan recipe
# scores near 1.0 and a heavy beef recipe scores near 0.0.
ECO_BEST_KG = 0.3   # very green recipe
ECO_WORST_KG = 8.0  # very emissive recipe


def _eco_score(co2_kg: float) -> float:
    if co2_kg <= ECO_BEST_KG:
        return 1.0
    if co2_kg >= ECO_WORST_KG:
        return 0.0
    return 1.0 - (co2_kg - ECO_BEST_KG) / (ECO_WORST_KG - ECO_BEST_KG)


def compute_recipe_footprint(recipe: Recipe) -> RecipeFootprint:
    """Compute the per-serving footprint for a single recipe."""
    items: list[IngredientFootprint] = []
    cats: list[str] = []
    total_co2 = 0.0
    total_cost = 0.0
    for ing in recipe.ingredients:
        category, co2_kg_per_kg, cost_per_kg, serving_kg = _lookup_ingredient(ing)
        co2 = co2_kg_per_kg * serving_kg
        cost = cost_per_kg * serving_kg
        total_co2 += co2
        total_cost += cost
        items.append(
            IngredientFootprint(
                name=ing,
                category=category,
                co2_kg=co2,
                cost_usd=cost,
            )
        )
        if category not in cats:
            cats.append(category)

    items.sort(key=lambda it: it.co2_kg, reverse=True)
    return RecipeFootprint(
        recipe_id=recipe.recipe_id,
        co2_kg=total_co2,
        cost_usd=total_cost,
        eco_score=_eco_score(total_co2),
        breakdown=tuple(items),
        categories=tuple(cats),
    )


def summarize_week(footprints: Iterable[RecipeFootprint]) -> dict[str, float]:
    """Aggregate per-day footprints into a weekly summary block."""
    fps = list(footprints)
    if not fps:
        return {"co2_kg": 0.0, "cost_usd": 0.0, "eco_score": 0.0, "meals": 0}
    co2 = sum(f.co2_kg for f in fps)
    cost = sum(f.cost_usd for f in fps)
    eco = sum(f.eco_score for f in fps) / len(fps)
    return {
        "co2_kg": round(co2, 2),
        "cost_usd": round(cost, 2),
        "eco_score": round(eco, 3),
        "meals": len(fps),
    }
