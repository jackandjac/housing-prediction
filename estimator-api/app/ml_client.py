"""Async client for the Task 1 ML API, with error mapping and small caches."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx


class MlApiUnavailableError(Exception):
    """ml-api could not be reached, timed out, or has no model loaded."""


class MlApiRejectedError(Exception):
    """ml-api refused the input (HTTP 422)."""

    def __init__(self, detail: Any):
        super().__init__(str(detail))
        self.detail = detail


class MlClient:
    def __init__(self, http: httpx.AsyncClient, features_ttl: float):
        self._http = http
        self._features_ttl = features_ttl
        self._features: tuple[float, dict[str, Any]] | None = None
        self._features_lock = asyncio.Lock()
        # Models are immutable once trained, so their info can be cached forever.
        self._model_info: dict[str, dict[str, Any]] = {}

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            resp = await self._http.request(method, path, **kwargs)
        except httpx.TimeoutException:
            raise MlApiUnavailableError("the prediction service timed out") from None
        except httpx.HTTPError:
            raise MlApiUnavailableError("the prediction service is unreachable") from None
        if resp.status_code == 422:
            raise MlApiRejectedError(resp.json().get("detail"))
        if resp.status_code == 503:
            raise MlApiUnavailableError("the prediction service has no active model")
        if resp.status_code >= 400:
            raise MlApiUnavailableError(f"the prediction service returned HTTP {resp.status_code}")
        return resp.json()

    async def features(self, *, fresh: bool = False) -> dict[str, Any]:
        """Input schema of the active model, cached for a short TTL."""
        now = time.monotonic()
        cached = self._features
        if not fresh and cached and now - cached[0] < self._features_ttl:
            return cached[1]
        async with self._features_lock:
            cached = self._features
            if not fresh and cached and time.monotonic() - cached[0] < self._features_ttl:
                return cached[1]
            data = await self._request("GET", "/features")
            self._features = (time.monotonic(), data)
            return data

    async def predict(self, rows: list[dict[str, float]]) -> dict[str, Any]:
        return await self._request("POST", "/predict", json=rows)

    async def model_info(self, model_id: str) -> dict[str, Any]:
        if model_id not in self._model_info:
            self._model_info[model_id] = await self._request("GET", "/model-info", params={"model_id": model_id})
        return self._model_info[model_id]

    async def health(self) -> dict[str, Any]:
        return await self._request("GET", "/health")
