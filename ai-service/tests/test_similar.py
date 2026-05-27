"""Tests for the /similar endpoint and recommender.similar()."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.recommender import RecommenderService


def test_similar_returns_related_recipes():
    s = RecommenderService()
    s.load()
    out = s.similar("tomato-pasta", top_k=5)
    assert len(out) == 5
    ids = [r.recipe_id for r in out]
    # The input recipe must never be in its own similar list.
    assert "tomato-pasta" not in ids
    # Other Italian / pasta recipes should rank highly.
    assert any(rid in {"pesto-pasta", "carbonara", "veggie-lasagna", "margherita-pizza"} for rid in ids[:3])


def test_similar_unknown_recipe_returns_404():
    client = TestClient(app)
    resp = client.post("/similar/does-not-exist", json={"top_k": 5})
    assert resp.status_code == 404


def test_similar_endpoint_returns_results():
    client = TestClient(app)
    resp = client.post("/similar/chicken-stir-fry", json={"top_k": 3})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["recipe_id"] == "chicken-stir-fry"
    assert body["count"] == 3
    assert len(body["results"]) == 3
    for r in body["results"]:
        assert r["recipe_id"] != "chicken-stir-fry"
        assert "reason" in r


def test_similar_top_k_respected():
    s = RecommenderService()
    s.load()
    out = s.similar("greek-salad", top_k=2)
    assert len(out) == 2
