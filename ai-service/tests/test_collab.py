"""Tests for the collaborative-filter component."""

from __future__ import annotations

from app._text import Recipe
from app.collab import CollabFilter


def _make_corpus() -> list[Recipe]:
    return [
        Recipe("r1", "Veg Pasta", ("tomato", "pasta"), ("vegetarian", "italian"), "italian"),
        Recipe("r2", "Veg Lasagna", ("pasta", "spinach"), ("vegetarian", "italian"), "italian"),
        Recipe("r3", "Chicken Curry", ("chicken", "rice"), ("indian",), "indian"),
        Recipe("r4", "Beef Tacos", ("beef", "tortilla"), ("mexican",), "mexican"),
        Recipe("r5", "Veg Tacos", ("beans", "tortilla"), ("vegetarian", "mexican"), "mexican"),
    ]


def test_collab_filter_fits_and_scores() -> None:
    cf = CollabFilter()
    cf.fit(_make_corpus())
    assert cf.is_fitted
    sims = cf.similarity_to("r1")
    assert sims.shape[0] == 5
    # r2 shares Italian + vegetarian + pasta tag-token with r1 → highest sim.
    by_id = dict(zip(["r1", "r2", "r3", "r4", "r5"], sims.tolist()))
    assert by_id["r2"] > by_id["r3"]


def test_collab_score_query_averages_likes() -> None:
    cf = CollabFilter()
    cf.fit(_make_corpus())
    scores = cf.score_query(["r1", "r2"])  # liked two italian-veg recipes
    assert scores.shape[0] == 5
    by_id = dict(zip(["r1", "r2", "r3", "r4", "r5"], scores.tolist()))
    # r5 (veg + mexican) should score higher than r4 (beef-mexican) because
    # the user's liked profile is vegetarian.
    assert by_id["r5"] > by_id["r4"]


def test_collab_interactions_boost_pair_similarity() -> None:
    cf = CollabFilter()
    cf.fit(_make_corpus())
    before = cf.similarity_to("r3")  # chicken curry
    by_id_before = dict(zip(["r1", "r2", "r3", "r4", "r5"], before.tolist()))

    # Record that r3 and r4 (unrelated cuisines) appeared together.
    pairs = cf.add_interactions(["r3", "r4"])
    assert pairs == 1

    after = cf.similarity_to("r3")
    by_id_after = dict(zip(["r1", "r2", "r3", "r4", "r5"], after.tolist()))
    assert by_id_after["r4"] > by_id_before["r4"]


def test_collab_add_interactions_validates_input() -> None:
    cf = CollabFilter()
    cf.fit(_make_corpus())
    assert cf.add_interactions([]) == 0
    assert cf.add_interactions(["r1"]) == 0  # too few
