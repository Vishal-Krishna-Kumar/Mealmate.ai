"""End-to-end tests for the FastAPI surface: new strategy + objective + footprint endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_capabilities_advertises_new_features() -> None:
    c = TestClient(app)
    r = c.get("/capabilities")
    assert r.status_code == 200
    body = r.json()
    feats = body["features"]
    assert feats["footprint"] is True
    assert feats["interactions"] is True
    assert feats["metrics"] is True
    assert set(feats["strategies"]) == {"tfidf", "lsa", "collab", "hybrid"}
    assert set(feats["planner_objectives"]) == {"balanced", "eco", "budget", "pantry"}


def test_recommend_supports_strategy_parameter() -> None:
    c = TestClient(app)
    r = c.post(
        "/recommend",
        json={
            "ingredients": ["tomato", "basil", "garlic"],
            "dietary_preferences": ["vegetarian"],
            "allergies": [],
            "top_k": 3,
            "strategy": "lsa",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["strategy"] == "lsa"
    assert body["count"] >= 1
    assert "signals" in body["results"][0]
    assert body["results"][0]["signals"][0]["name"] == "lsa"


def test_recommend_hybrid_returns_all_three_signals() -> None:
    c = TestClient(app)
    r = c.post(
        "/recommend",
        json={
            "ingredients": ["tomato", "garlic"],
            "dietary_preferences": [],
            "allergies": [],
            "top_k": 1,
            "strategy": "hybrid",
        },
    )
    assert r.status_code == 200
    sigs = r.json()["results"][0]["signals"]
    names = {s["name"] for s in sigs}
    assert names == {"tfidf", "lsa", "collab"}


def test_plan_week_respects_objective() -> None:
    c = TestClient(app)
    r = c.post(
        "/plan/week",
        json={
            "ingredients": ["tomato", "spinach", "rice"],
            "dietary_preferences": ["vegetarian"],
            "allergies": [],
            "use_llm": False,
            "objective": "eco",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["objective"] == "eco"
    # eco preset should weight eco above similarity
    assert body["weights"]["eco"] > body["weights"]["similarity"]
    assert "sustainability" in body
    assert body["sustainability"]["meals"] > 0


def test_recipe_footprint_returns_breakdown() -> None:
    c = TestClient(app)
    r = c.get("/recipes/tomato-pasta/footprint")
    assert r.status_code == 200
    body = r.json()
    assert body["recipe_id"] == "tomato-pasta"
    assert body["co2_kg"] > 0
    assert body["cost_usd"] > 0
    assert 0.0 <= body["eco_score"] <= 1.0
    assert len(body["breakdown"]) > 0


def test_recipe_footprint_404_for_unknown() -> None:
    c = TestClient(app)
    r = c.get("/recipes/this-does-not-exist/footprint")
    assert r.status_code == 404


def test_interactions_record_endpoint() -> None:
    c = TestClient(app)
    r = c.post(
        "/interactions/record",
        json={"recipe_ids": ["tomato-pasta", "veggie-omelette", "lentil-soup"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["pairs"] >= 1


def test_metrics_endpoint_returns_prometheus_text() -> None:
    c = TestClient(app)
    # Trigger one request so counters are non-zero.
    c.post(
        "/recommend",
        json={
            "ingredients": ["tomato"],
            "dietary_preferences": [],
            "allergies": [],
            "top_k": 1,
            "strategy": "tfidf",
        },
    )
    r = c.get("/metrics")
    assert r.status_code == 200
    assert "ai_requests_total" in r.text


def test_pantry_vision_gracefully_degrades_without_llm() -> None:
    """When Gemini is unavailable or returns nothing, /pantry/vision returns
    a structured ``available=False`` payload instead of crashing."""
    c = TestClient(app)
    # Send a 1x1 transparent PNG. Without a working LLM call this should
    # respond with available=false rather than raising.
    tiny_png = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAA"
        "AAYAAjCB0C8AAAAASUVORK5CYII="
    )
    r = c.post("/pantry/vision", json={"image_base64": tiny_png})
    assert r.status_code == 200
    body = r.json()
    assert "available" in body
    assert "items" in body
