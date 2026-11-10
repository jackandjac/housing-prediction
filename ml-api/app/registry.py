"""On-disk model registry and the in-memory active model."""

from __future__ import annotations

import json
import os
import shutil
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.pipeline import Pipeline

from .features import Schema


class ModelNotFoundError(Exception):
    pass


class ModelIncompatibleError(Exception):
    pass


@dataclass(frozen=True)
class LoadedModel:
    model_id: str
    features: list[str]
    pipeline: Pipeline
    metadata: dict[str, Any]

    def predict(self, rows: list[dict[str, Any]]) -> list[float]:
        X = np.array([[float(r[f]) for f in self.features] for r in rows], dtype=float)
        return [round(float(p), 2) for p in self.pipeline.predict(X)]


def _write_json_atomic(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, path)


class ModelRegistry:
    """Models live in `<models_dir>/<model_id>/{model.joblib,metadata.json}`.

    The id of the active model is persisted to a pointer file so it survives
    restarts; the loaded pipeline is cached in memory and swapped under a lock.
    """

    def __init__(self, models_dir: Path, active_pointer: Path, schema: Schema):
        self._dir = models_dir
        self._pointer = active_pointer
        self._schema = schema
        self._lock = threading.Lock()
        self._active: LoadedModel | None = None
        self._dir.mkdir(parents=True, exist_ok=True)

    # ---- persistence -------------------------------------------------------

    def save(self, model_id: str, pipeline: Pipeline, metadata: dict[str, Any]) -> None:
        final = self._dir / model_id
        staging = self._dir / f".{model_id}.partial"
        staging.mkdir(parents=True, exist_ok=False)
        try:
            joblib.dump(pipeline, staging / "model.joblib")
            _write_json_atomic(staging / "metadata.json", metadata)
            os.replace(staging, final)  # model only becomes visible once complete
        except BaseException:
            shutil.rmtree(staging, ignore_errors=True)
            raise

    def metadata(self, model_id: str) -> dict[str, Any]:
        path = self._dir / model_id / "metadata.json"
        if not model_id or "/" in model_id or model_id.startswith(".") or not path.is_file():
            raise ModelNotFoundError(model_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def list(self) -> list[dict[str, Any]]:
        items = []
        for d in self._dir.iterdir():
            if d.is_dir() and not d.name.startswith(".") and (d / "metadata.json").is_file():
                items.append(json.loads((d / "metadata.json").read_text(encoding="utf-8")))
        return sorted(items, key=lambda m: m["created_at"], reverse=True)

    def _load(self, model_id: str) -> LoadedModel:
        meta = self.metadata(model_id)
        unknown = [f for f in meta["features"] if self._schema.get(f) is None]
        if unknown:
            raise ModelIncompatibleError(
                f"model {model_id} uses feature(s) not in the current schema: {', '.join(unknown)}"
            )
        pipeline = joblib.load(self._dir / model_id / "model.joblib")
        return LoadedModel(model_id=model_id, features=meta["features"], pipeline=pipeline, metadata=meta)

    # ---- active model ------------------------------------------------------

    @property
    def active(self) -> LoadedModel | None:
        return self._active

    def activate(self, model_id: str) -> LoadedModel:
        loaded = self._load(model_id)  # load outside the lock; may be slow
        with self._lock:
            _write_json_atomic(self._pointer, {"model_id": model_id})
            self._active = loaded
        return loaded

    def activate_if_none(self, model_id: str) -> bool:
        with self._lock:
            if self._active is not None:
                return False
            loaded = self._load(model_id)
            _write_json_atomic(self._pointer, {"model_id": model_id})
            self._active = loaded
            return True

    def restore_active(self) -> None:
        """Load the active model recorded on disk, if any."""
        if not self._pointer.is_file():
            return
        model_id = json.loads(self._pointer.read_text(encoding="utf-8")).get("model_id")
        if model_id:
            self._active = self._load(model_id)
