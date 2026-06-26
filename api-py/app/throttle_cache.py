from __future__ import annotations

import hashlib
import json
import time
from typing import Any

RATE_WINDOW_MS = 60_000
RATE_MAX = 20
CACHE_TTL_MS = 60_000

_buckets: dict[str, dict[str, float | int]] = {}
_cache: dict[str, tuple[float, Any]] = {}


def body_hash(bundle_dict: dict) -> str:
    raw = json.dumps(bundle_dict, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def check_throttle(key: str) -> tuple[bool, int]:
    """返回 (allowed, retry_after_sec)。"""
    now = time.time() * 1000
    b = _buckets.get(key)
    if not b or now > float(b["reset_at"]):
        b = {"tokens": RATE_MAX, "reset_at": now + RATE_WINDOW_MS}
        _buckets[key] = b
    if int(b["tokens"]) <= 0:
        retry = max(1, int((float(b["reset_at"]) - now) / 1000) + 1)
        return (False, retry)
    b["tokens"] = int(b["tokens"]) - 1
    return (True, 0)


def cache_get(key: str) -> Any | None:
    e = _cache.get(key)
    if not e:
        return None
    expires, payload = e
    if time.time() * 1000 > expires:
        del _cache[key]
        return None
    return payload


def cache_set(key: str, payload: Any) -> None:
    _cache[key] = (time.time() * 1000 + CACHE_TTL_MS, payload)
