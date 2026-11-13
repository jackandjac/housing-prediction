"""Persistent store for training jobs (MongoDB).

One document per job, keyed by the job id (``_id``). Timestamps are kept as the
same ISO-8601 "...Z" strings the API returns: they sort correctly as text, so
the response format did not change when the store moved from SQLite to MongoDB.

The sync driver is used on purpose: the endpoints are sync and training runs in
a thread pool. ``MongoClient`` is thread-safe and pools its own connections.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

import pymongo
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import PyMongoError


class JobStatus(StrEnum):
    submitted = "submitted"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class DatabaseUnavailableError(Exception):
    """MongoDB could not be reached or rejected the operation (message is redacted)."""


def utcnow() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def redact(text: object) -> str:
    """Strip credentials from driver error messages before they reach logs or responses."""
    return re.sub(r"//[^@/\s]+@", "//***@", str(text))


FIELDS = (
    "id",
    "status",
    "model_type",
    "alpha",
    "source_filename",
    "dataset_sha256",
    "rows",
    "features",
    "ignored_columns",
    "callback_url",
    "created_at",
    "started_at",
    "finished_at",
    "error",
    "model_id",
    "activated",
    "webhook_status",
    "webhook_attempts",
    "webhook_last_error",
)
_DEFAULTS: dict[str, Any] = {"features": [], "ignored_columns": [], "activated": False, "webhook_attempts": 0}
_NEWEST_FIRST = [("created_at", DESCENDING), ("_id", DESCENDING)]  # _id breaks millisecond ties


def _to_api(doc: dict[str, Any]) -> dict[str, Any]:
    out = {f: doc.get(f, _DEFAULTS.get(f)) for f in FIELDS if f != "id"}
    out["id"] = doc["_id"]
    return out


class JobStore:
    def __init__(self, uri: str, db: str, collection: str, timeout_ms: int = 5000):
        # Lazy connect: constructing the client does no network I/O.
        self._client: MongoClient = MongoClient(uri, serverSelectionTimeoutMS=timeout_ms, appname="housing-ml-api")
        self._coll = self._client[db][collection]

    def _call(self, fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except PyMongoError as exc:
            raise DatabaseUnavailableError(redact(exc)) from None

    def init(self) -> None:
        """Create indexes (idempotent). Raises DatabaseUnavailableError if MongoDB is unreachable."""
        self._call(self._coll.create_index, _NEWEST_FIRST, name="newest_first")
        self._call(
            self._coll.create_index,
            [("status", ASCENDING), *_NEWEST_FIRST],
            name="status_newest_first",
        )

    def close(self) -> None:
        self._client.close()

    def ping(self, timeout: float = 1.5) -> bool:
        """Quick reachability check for /health; bounded so the container health check never times out."""
        try:
            with pymongo.timeout(timeout):
                self._client.admin.command("ping")
            return True
        except PyMongoError:
            return False

    def drop(self) -> None:
        """Delete the whole collection (tests only)."""
        self._call(self._coll.drop)

    def create(self, job: dict[str, Any]) -> dict[str, Any]:
        doc = {f: job.get(f, _DEFAULTS.get(f)) for f in FIELDS if f != "id"}
        doc["_id"] = job["id"]
        doc["status"] = str(doc["status"])
        doc["activated"] = bool(doc["activated"])
        doc["webhook_attempts"] = doc["webhook_attempts"] or 0
        doc["features"] = list(doc["features"] or [])
        doc["ignored_columns"] = list(doc["ignored_columns"] or [])
        self._call(self._coll.insert_one, doc)
        return _to_api(doc)

    def update(self, job_id: str, **fields: Any) -> None:
        unknown = set(fields) - (set(FIELDS) - {"id"})
        if unknown:
            raise ValueError(f"unknown field(s): {unknown}")
        if "status" in fields:
            fields["status"] = str(fields["status"])
        if "activated" in fields:
            fields["activated"] = bool(fields["activated"])
        self._call(self._coll.update_one, {"_id": job_id}, {"$set": fields})

    def get(self, job_id: str) -> dict[str, Any] | None:
        doc = self._call(self._coll.find_one, {"_id": job_id})
        return _to_api(doc) if doc else None

    def list(self, limit: int = 100, status: JobStatus | None = None) -> list[dict[str, Any]]:
        query = {"status": status.value} if status else {}
        docs = self._call(lambda: list(self._coll.find(query).sort(_NEWEST_FIRST).limit(limit)))
        return [_to_api(d) for d in docs]

    def fail_interrupted(self) -> int:
        """Mark jobs left unfinished by a previous process as failed."""
        result = self._call(
            self._coll.update_many,
            {"status": {"$in": [JobStatus.submitted.value, JobStatus.running.value]}},
            {
                "$set": {
                    "status": JobStatus.failed.value,
                    "error": "interrupted by service restart",
                    "finished_at": utcnow(),
                }
            },
        )
        return result.modified_count
