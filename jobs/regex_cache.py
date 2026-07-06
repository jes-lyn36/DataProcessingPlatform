import hashlib

from django.conf import settings
from django.core.cache import cache

REGEX_CACHE_KEY_PREFIX = "llm_regex:"


def _prompt_cache_key(prompt: str) -> str:
    normalized = " ".join(prompt.strip().split())
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"{REGEX_CACHE_KEY_PREFIX}{digest}"


def get_cached_regex(prompt: str) -> dict | None:
    """Return a cached regex result for an identical natural-language prompt."""
    cached = cache.get(_prompt_cache_key(prompt))
    if not cached:
        return None
    if isinstance(cached, dict):
        return cached
    return {"regex": cached, "target_columns": []}


def set_cached_regex(prompt: str, result: dict | str, timeout: int | None = None) -> None:
    """Cache an LLM-generated regex result keyed by the natural-language prompt."""
    if isinstance(result, str):
        payload = {"regex": result, "target_columns": []}
    else:
        payload = result

    cache.set(
        _prompt_cache_key(prompt),
        payload,
        timeout=timeout or settings.REGEX_CACHE_TTL,
    )
