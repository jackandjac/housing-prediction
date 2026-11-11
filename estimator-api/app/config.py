"""Runtime settings, read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    ml_api_url: str = "http://localhost:8000"
    # repr=False: the URI contains the database password and must never be printed or logged.
    mongodb_uri: str = field(default="", repr=False)
    mongodb_db: str = "housing"
    mongodb_collection: str = "estimates"
    ml_api_timeout_seconds: float = 10.0
    features_ttl_seconds: float = 30.0
    max_compare: int = 4
    max_page_size: int = 100

    @classmethod
    def from_env(cls) -> Settings:
        env = os.environ
        return cls(
            ml_api_url=env.get("ML_API_URL", "http://localhost:8000").rstrip("/"),
            mongodb_uri=env.get("MONGODB_URI", ""),
            mongodb_db=env.get("MONGODB_DB", "housing"),
            mongodb_collection=env.get("MONGODB_COLLECTION", "estimates"),
            ml_api_timeout_seconds=float(env.get("ML_API_TIMEOUT_SECONDS", 10)),
            features_ttl_seconds=float(env.get("FEATURES_TTL_SECONDS", 30)),
        )
