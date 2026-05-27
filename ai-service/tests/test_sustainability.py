"""Tests for the sustainability footprint module."""

from __future__ import annotations

from app._text import Recipe
from app.sustainability import (
    compute_recipe_footprint,
    summarize_week,
)


def _recipe(rid: str, ings: tuple[str, ...]) -> Recipe:
    return Recipe(
        recipe_id=rid,
        title=rid.replace("-", " ").title(),
        ingredients=ings,
        tags=("dinner",),
        cuisine=None,
    )


def test_compute_recipe_footprint_known_ingredients() -> None:
    r = _recipe("beef-bowl", ("beef", "rice", "onion"))
    fp = compute_recipe_footprint(r)
    assert fp.recipe_id == "beef-bowl"
    # Beef should dominate emissions, pushing the recipe well above 1 kg CO2.
    assert fp.co2_kg > 1.0
    # Eco score is 0-1 and beef is firmly on the high-emission side.
    assert 0.0 <= fp.eco_score <= 1.0
    assert fp.cost_usd > 0
    assert any(item.category == "meat" for item in fp.breakdown)


def test_compute_recipe_footprint_vegetarian_better_than_beef() -> None:
    veg = compute_recipe_footprint(_recipe("veg-bowl", ("lentil", "tomato", "rice", "spinach")))
    beef = compute_recipe_footprint(_recipe("beef-bowl", ("beef", "rice", "tomato")))
    assert veg.co2_kg < beef.co2_kg
    assert veg.eco_score > beef.eco_score


def test_compute_recipe_footprint_unknown_falls_back_to_default() -> None:
    fp = compute_recipe_footprint(_recipe("mystery", ("fictional_unicorn_meat",)))
    # Falls back to defaults; still produces a sensible non-zero footprint.
    assert fp.co2_kg > 0
    assert fp.cost_usd > 0


def test_summarize_week_sums_components() -> None:
    fps = [
        compute_recipe_footprint(_recipe("a", ("tomato", "rice"))),
        compute_recipe_footprint(_recipe("b", ("chicken", "broccoli"))),
    ]
    summary = summarize_week(fps)
    assert summary["meals"] == 2
    assert summary["co2_kg"] > 0
    assert summary["cost_usd"] > 0
    assert 0.0 <= summary["eco_score"] <= 1.0


def test_summarize_week_handles_empty() -> None:
    summary = summarize_week([])
    assert summary == {"co2_kg": 0.0, "cost_usd": 0.0, "eco_score": 0.0, "meals": 0}
