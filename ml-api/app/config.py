"""Runtime settings, read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_BOOTSTRAP = APP_ROOT.parent / "data" / "House_Price_Dataset.csv"


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    """Where models, uploads and the job database are stored (mount a volume here)."""
    features_path: Path
    bootstrap_data_path: Path | None
    """Dataset used to train the first model when none exists yet. None disables it."""
    bootstrap_model_type: str = "ridge"
    bootstrap_alpha: float = 1.0
    max_upload_bytes: int = 5 * 1024 * 1024
    min_training_rows: int = 10
    max_batch_size: int = 1000
    training_workers: int = 2
    webhook_secret: str | None = None
    webhook_timeout_seconds: float = 5.0
    webhook_max_attempts: int = 3
    webhook_backoff_seconds: float = 1.0

    @classmethod
    def from_env(cls) -> Settings:
        env = os.environ
        bootstrap = env.get("BOOTSTRAP_DATA_PATH")
        return cls(
            data_dir=Path(env.get("DATA_DIR", APP_ROOT / "var")),
            features_path=Path(env.get("FEATURES_PATH", APP_ROOT / "features.yaml")),
            # Unset -> repo default; empty string -> disabled.
            bootstrap_data_path=(_DEFAULT_BOOTSTRAP if bootstrap is None else (Path(bootstrap) if bootstrap else None)),
            bootstrap_model_type=env.get("BOOTSTRAP_MODEL_TYPE", "ridge"),
            bootstrap_alpha=float(env.get("BOOTSTRAP_ALPHA", 1.0)),
            max_upload_bytes=int(env.get("MAX_UPLOAD_BYTES", 5 * 1024 * 1024)),
            min_training_rows=int(env.get("MIN_TRAINING_ROWS", 10)),
            max_batch_size=int(env.get("MAX_BATCH_SIZE", 1000)),
            training_workers=int(env.get("TRAINING_WORKERS", 2)),
            webhook_secret=env.get("WEBHOOK_SECRET") or None,
            webhook_timeout_seconds=float(env.get("WEBHOOK_TIMEOUT_SECONDS", 5)),
            webhook_max_attempts=int(env.get("WEBHOOK_MAX_ATTEMPTS", 3)),
            webhook_backoff_seconds=float(env.get("WEBHOOK_BACKOFF_SECONDS", 1)),
        )

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "trainings.db"

    @property
    def active_pointer_path(self) -> Path:
        return self.data_dir / "active_model.json"
