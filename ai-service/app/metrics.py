"""Prometheus metrics for the AI service.

Exposes a ``/metrics`` endpoint that Prometheus / Grafana can scrape. The
counters and histograms are deliberately small and high-signal:

- ``ai_requests_total{endpoint,status}`` — request volume per route
- ``ai_request_duration_seconds{endpoint}`` — latency histogram per route
- ``llm_calls_total{provider,operation,outcome}`` — Gemini call outcomes
- ``llm_cache_hits_total{bucket}`` / ``llm_cache_misses_total{bucket}``
- ``recommender_requests_total{strategy}`` — split of TF-IDF vs LSA vs hybrid

prometheus_client is an optional dependency: when the import fails the
middleware degrades to a no-op so unit tests run without the wheel.
"""

from __future__ import annotations

import time
from typing import Awaitable, Callable

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        Counter,
        Histogram,
        generate_latest,
    )

    REGISTRY = CollectorRegistry(auto_describe=True)

    REQUESTS = Counter(
        "ai_requests_total",
        "Total AI service requests",
        ["endpoint", "status"],
        registry=REGISTRY,
    )
    LATENCY = Histogram(
        "ai_request_duration_seconds",
        "AI request duration in seconds",
        ["endpoint"],
        buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
        registry=REGISTRY,
    )
    LLM_CALLS = Counter(
        "llm_calls_total",
        "Gemini calls made by the AI service",
        ["provider", "operation", "outcome"],
        registry=REGISTRY,
    )
    RECOMMENDER_CALLS = Counter(
        "recommender_requests_total",
        "Recommender invocations by strategy",
        ["strategy"],
        registry=REGISTRY,
    )

    PROMETHEUS_AVAILABLE = True
except Exception:  # pragma: no cover - lib optional
    PROMETHEUS_AVAILABLE = False
    REGISTRY = None  # type: ignore[assignment]
    REQUESTS = LATENCY = LLM_CALLS = RECOMMENDER_CALLS = None  # type: ignore[assignment]
    CONTENT_TYPE_LATEST = "text/plain; charset=utf-8"  # type: ignore[assignment]

    def generate_latest(_registry=None) -> bytes:  # type: ignore[no-redef]
        return b"# prometheus_client not installed\n"


class MetricsMiddleware(BaseHTTPMiddleware):
    """Records counters + latency for every API call."""

    async def dispatch(  # type: ignore[override]
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not PROMETHEUS_AVAILABLE or request.url.path == "/metrics":
            return await call_next(request)
        start = time.perf_counter()
        try:
            response = await call_next(request)
            status = str(response.status_code)
        except Exception:
            REQUESTS.labels(endpoint=request.url.path, status="500").inc()  # type: ignore[union-attr]
            raise
        duration = time.perf_counter() - start
        LATENCY.labels(endpoint=request.url.path).observe(duration)  # type: ignore[union-attr]
        REQUESTS.labels(endpoint=request.url.path, status=status).inc()  # type: ignore[union-attr]
        return response


def record_llm_call(operation: str, outcome: str, provider: str = "gemini") -> None:
    if PROMETHEUS_AVAILABLE and LLM_CALLS is not None:
        LLM_CALLS.labels(provider=provider, operation=operation, outcome=outcome).inc()


def record_recommender_call(strategy: str) -> None:
    if PROMETHEUS_AVAILABLE and RECOMMENDER_CALLS is not None:
        RECOMMENDER_CALLS.labels(strategy=strategy).inc()


def metrics_response() -> Response:
    if not PROMETHEUS_AVAILABLE:
        return Response(
            content="# prometheus_client not installed\n",
            media_type="text/plain; charset=utf-8",
        )
    payload = generate_latest(REGISTRY)
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)


def install(app: FastAPI) -> None:
    """Mount the middleware + ``/metrics`` route onto a FastAPI app."""
    app.add_middleware(MetricsMiddleware)

    @app.get("/metrics", include_in_schema=False)
    def _metrics() -> Response:  # pragma: no cover - simple passthrough
        return metrics_response()
