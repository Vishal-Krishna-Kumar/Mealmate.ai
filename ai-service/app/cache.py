"""TTL-LRU cache for LLM and embedding calls.

External LLM calls (Gemini chat, vision, embeddings) are by far the slowest
and most expensive part of the request lifecycle. This module gives every
LLM-touching function a deterministic-keyed cache so repeated requests with
identical inputs return instantly without burning quota.

The cache is intentionally simple: an OrderedDict-backed LRU plus a per-entry
TTL. Configuration is environment-driven (``LLM_CACHE_TTL_SECONDS``,
``LLM_CACHE_MAX_ENTRIES``). Prometheus counters are bumped on every hit/miss
so the operator can observe cache effectiveness from ``/metrics``.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from collections import OrderedDict
from typing import Any, Callable

try:
    from prometheus_client import Counter
    _HIT = Counter("llm_cache_hits_total", "LLM cache hits", ["bucket"])
    _MISS = Counter("llm_cache_misses_total", "LLM cache misses", ["bucket"])
except Exception:  # pragma: no cover - prometheus is optional
    _HIT = _MISS = None  # type: ignore[assignment]


def _ttl_seconds() -> int:
    try:
        return int(os.environ.get("LLM_CACHE_TTL_SECONDS", "900"))
    except ValueError:
        return 900


def _max_entries() -> int:
    try:
        return int(os.environ.get("LLM_CACHE_MAX_ENTRIES", "512"))
    except ValueError:
        return 512


class TTLCache:
    """Thread-safe TTL + LRU cache."""

    def __init__(self, max_entries: int | None = None, ttl_seconds: int | None = None) -> None:
        self._max = max_entries if max_entries is not None else _max_entries()
        self._ttl = ttl_seconds if ttl_seconds is not None else _ttl_seconds()
        self._store: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
        self._lock = threading.Lock()

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [k for k, (exp, _) in self._store.items() if exp < now]
        for k in expired:
            self._store.pop(k, None)

    def get(self, key: str) -> Any | None:
        with self._lock:
            self._evict_expired()
            item = self._store.get(key)
            if item is None:
                return None
            # Refresh LRU order.
            self._store.move_to_end(key)
            return item[1]

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._evict_expired()
            self._store[key] = (time.monotonic() + self._ttl, value)
            self._store.move_to_end(key)
            while len(self._store) > self._max:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def stats(self) -> dict[str, int]:
        with self._lock:
            self._evict_expired()
            return {"entries": len(self._store), "max_entries": self._max, "ttl_seconds": self._ttl}


_caches: dict[str, TTLCache] = {}
_caches_lock = threading.Lock()


def get_cache(bucket: str) -> TTLCache:
    with _caches_lock:
        cache = _caches.get(bucket)
        if cache is None:
            cache = TTLCache()
            _caches[bucket] = cache
        return cache


def make_key(*parts: object) -> str:
    """Build a stable cache key from arbitrary, JSON-serialisable parts."""
    blob = json.dumps(parts, sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def cached(bucket: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator that memoises a function's return value by its arguments.

    ``None`` returns are *not* cached so transient LLM failures retry on the
    next call instead of pinning a bad response for the whole TTL.
    """
    cache = get_cache(bucket)

    def deco(fn: Callable[..., Any]) -> Callable[..., Any]:
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            key = make_key(fn.__module__, fn.__qualname__, args, kwargs)
            cached_val = cache.get(key)
            if cached_val is not None:
                if _HIT is not None:
                    _HIT.labels(bucket=bucket).inc()
                return cached_val
            if _MISS is not None:
                _MISS.labels(bucket=bucket).inc()
            value = fn(*args, **kwargs)
            if value is not None:
                cache.set(key, value)
            return value

        wrapped.__name__ = fn.__name__
        wrapped.__qualname__ = fn.__qualname__
        wrapped.__doc__ = fn.__doc__
        return wrapped

    return deco


def caches_snapshot() -> dict[str, dict[str, int]]:
    """Operator-facing summary used by ``/capabilities`` and ``/metrics``."""
    with _caches_lock:
        return {bucket: c.stats() for bucket, c in _caches.items()}


def clear_all_caches() -> None:
    """Test helper — drops every cached entry across all buckets."""
    with _caches_lock:
        for c in _caches.values():
            c.clear()
