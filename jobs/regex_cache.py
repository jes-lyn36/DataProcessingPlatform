import hashlib

from django.conf import settings
from django.core.cache import cache

REGEX_CACHE_KEY_PREFIX = "llm_regex:"


def _prompt_cache_key(prompt: str) -> str:
    normalized = " ".join(prompt.strip().split())
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"{REGEX_CACHE_KEY_PREFIX}{digest}"


def get_cached_regex(prompt: str) -> str | None:
    """Return a cached regex pattern for an identical natural-language prompt."""
    return cache.get(_prompt_cache_key(prompt))


def set_cached_regex(prompt: str, pattern: str, timeout: int | None = None) -> None:
    """Cache an LLM-generated regex pattern keyed by the natural-language prompt."""
    cache.set(
        _prompt_cache_key(prompt),
        pattern,
        timeout=timeout or settings.REGEX_CACHE_TTL,
    )
