"""Persistent store for training jobs (SQLite)."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any


class JobStatus(StrEnum):
    submitted = "submitted"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


def utcnow() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


_COLUMNS = (
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
_JSON_COLUMNS = {"features", "ignored_columns"}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS trainings (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    model_type TEXT NOT NULL,
    alpha REAL,
    source_filename TEXT,
    dataset_sha256 TEXT NOT NULL,
    rows INTEGER NOT NULL,
    features TEXT NOT NULL,
    ignored_columns TEXT NOT NULL,
    callback_url TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error TEXT,
    model_id TEXT,
    activated INTEGER NOT NULL DEFAULT 0,
    webhook_status TEXT,
    webhook_attempts INTEGER NOT NULL DEFAULT 0,
    webhook_last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_trainings_created ON trainings(created_at);
"""


class JobStore:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.executescript(_SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    @staticmethod
    def _to_dict(row: sqlite3.Row) -> dict[str, Any]:
        d = dict(row)
        for c in _JSON_COLUMNS:
            d[c] = json.loads(d[c]) if d[c] is not None else []
        d["activated"] = bool(d["activated"])
        return d

    def create(self, job: dict[str, Any]) -> dict[str, Any]:
        values = {c: job.get(c) for c in _COLUMNS}
        for c in _JSON_COLUMNS:
            values[c] = json.dumps(values[c] or [])
        values["activated"] = int(bool(values["activated"]))
        values["webhook_attempts"] = values["webhook_attempts"] or 0
        cols = ", ".join(_COLUMNS)
        marks = ", ".join(f":{c}" for c in _COLUMNS)
        with self._lock:
            self._conn.execute(f"INSERT INTO trainings ({cols}) VALUES ({marks})", values)
        return self.get(job["id"])  # type: ignore[return-value]

    def update(self, job_id: str, **fields: Any) -> None:
        unknown = set(fields) - set(_COLUMNS)
        if unknown:
            raise ValueError(f"unknown column(s): {unknown}")
        for c in _JSON_COLUMNS & fields.keys():
            fields[c] = json.dumps(fields[c])
        if "activated" in fields:
            fields["activated"] = int(bool(fields["activated"]))
        assignments = ", ".join(f"{k} = :{k}" for k in fields)
        with self._lock:
            self._conn.execute(f"UPDATE trainings SET {assignments} WHERE id = :_id", {**fields, "_id": job_id})

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM trainings WHERE id = ?", (job_id,)).fetchone()
        return self._to_dict(row) if row else None

    def list(self, limit: int = 100, status: JobStatus | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM trainings"
        params: list[Any] = []
        if status:
            query += " WHERE status = ?"
            params.append(status.value)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with self._lock:
            rows = self._conn.execute(query, params).fetchall()
        return [self._to_dict(r) for r in rows]

    def fail_interrupted(self) -> int:
        """Mark jobs left unfinished by a previous process as failed."""
        with self._lock:
            cur = self._conn.execute(
                "UPDATE trainings SET status = ?, error = ?, finished_at = ? WHERE status IN (?, ?)",
                (JobStatus.failed, "interrupted by service restart", utcnow(), JobStatus.submitted, JobStatus.running),
            )
        return cur.rowcount
