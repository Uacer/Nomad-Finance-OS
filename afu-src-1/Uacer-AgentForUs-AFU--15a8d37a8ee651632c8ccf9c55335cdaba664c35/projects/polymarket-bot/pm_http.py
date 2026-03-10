"""pm_http.py - shared HTTP utilities for Polymarket APIs

Goals:
- Reuse connections via a shared requests.Session()
- Standardize timeouts
- Provide lightweight retry/backoff for transient failures (429/5xx/timeouts)

This module is intentionally dependency-free (requests only).
"""

from __future__ import annotations

import random
import time
from typing import Any, Dict, Optional

import requests


DEFAULT_TIMEOUT = 30

_session: Optional[requests.Session] = None


def session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        # Keep a stable UA to reduce WAF weirdness.
        s.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }
        )
        _session = s
    return _session


def request_json(
    method: str,
    url: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    json_body: Any = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = DEFAULT_TIMEOUT,
    retries: int = 3,
    backoff_base: float = 1.2,
    backoff_jitter: float = 0.3,
    respect_retry_after: bool = True,
) -> Any:
    """HTTP request returning parsed JSON with basic retry/backoff.

    Retries on:
    - 429 (rate limited)
    - 5xx
    - request timeouts / transient connection errors

    Cloudflare throttling may delay rather than hard-fail; this still helps on spikes.
    """

    last_err: Optional[Exception] = None

    for attempt in range(retries + 1):
        try:
            r = session().request(
                method,
                url,
                params=params,
                json=json_body,
                headers=headers,
                timeout=timeout,
            )

            if r.status_code == 429 or (500 <= r.status_code <= 599):
                # Retryable
                wait_s = backoff_base ** attempt
                wait_s += random.random() * backoff_jitter

                if respect_retry_after:
                    ra = r.headers.get("Retry-After")
                    if ra:
                        try:
                            wait_s = max(wait_s, float(ra))
                        except:
                            pass

                if attempt >= retries:
                    r.raise_for_status()

                time.sleep(wait_s)
                continue

            r.raise_for_status()
            return r.json()

        except (requests.Timeout, requests.ConnectionError) as e:
            last_err = e
            if attempt >= retries:
                raise
            wait_s = (backoff_base ** attempt) + random.random() * backoff_jitter
            time.sleep(wait_s)

        except Exception as e:
            # Non-retryable parse/HTTP errors
            last_err = e
            raise

    # Should never reach
    if last_err:
        raise last_err
    raise RuntimeError("request_json failed")
