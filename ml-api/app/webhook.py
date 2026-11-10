"""Webhook delivery for training-completed notifications."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger(__name__)

SIGNATURE_HEADER = "X-Webhook-Signature"


@dataclass
class DeliveryResult:
    delivered: bool
    attempts: int
    last_error: str | None


def sign(body: bytes, secret: str) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def deliver(
    url: str,
    payload: dict[str, Any],
    *,
    secret: str | None,
    timeout: float,
    max_attempts: int,
    backoff: float,
) -> DeliveryResult:
    """POST the payload as JSON, retrying with exponential backoff on errors or non-2xx."""
    body = json.dumps(payload, separators=(",", ":")).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "housing-ml-api-webhook/1.0"}
    if secret:
        headers[SIGNATURE_HEADER] = sign(body, secret)

    last_error: str | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            resp = httpx.post(url, content=body, headers=headers, timeout=timeout, follow_redirects=False)
            if 200 <= resp.status_code < 300:
                return DeliveryResult(True, attempt, None)
            last_error = f"HTTP {resp.status_code}"
        except httpx.HTTPError as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        log.warning("webhook to %s failed (attempt %d/%d): %s", url, attempt, max_attempts, last_error)
        if attempt < max_attempts:
            time.sleep(backoff * 2 ** (attempt - 1))
    return DeliveryResult(False, max_attempts, last_error)
