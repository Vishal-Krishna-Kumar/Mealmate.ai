"""Tests for the TTL/LRU LLM cache."""

from __future__ import annotations

import time

from app.cache import TTLCache, get_cache, make_key


def test_make_key_is_deterministic() -> None:
    a = make_key("recommend", ["tomato", "garlic"], {"prefs": ["veg"]})
    b = make_key("recommend", ["tomato", "garlic"], {"prefs": ["veg"]})
    assert a == b
    c = make_key("recommend", ["tomato", "onion"], {"prefs": ["veg"]})
    assert a != c


def test_cache_set_get_round_trip() -> None:
    cache = TTLCache(ttl_seconds=60.0, max_entries=4)
    cache.set("k1", "v1")
    assert cache.get("k1") == "v1"
    assert cache.get("missing") is None


def test_cache_evicts_lru_when_full() -> None:
    cache = TTLCache(ttl_seconds=60.0, max_entries=2)
    cache.set("a", 1)
    cache.set("b", 2)
    # Touch 'a' so 'b' is least-recently-used.
    cache.get("a")
    cache.set("c", 3)
    assert cache.get("b") is None  # evicted
    assert cache.get("a") == 1
    assert cache.get("c") == 3


def test_cache_expires_after_ttl() -> None:
    cache = TTLCache(ttl_seconds=0.05, max_entries=4)
    cache.set("k", "v")
    assert cache.get("k") == "v"
    time.sleep(0.1)
    assert cache.get("k") is None


def test_named_buckets_are_isolated() -> None:
    a = get_cache("test-bucket-a")
    b = get_cache("test-bucket-b")
    assert a is not b
    a.set("k", 1)
    assert b.get("k") is None
