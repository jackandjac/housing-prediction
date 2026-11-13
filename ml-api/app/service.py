"""Training orchestration: accepts jobs, runs them in the background, notifies."""

from __future__ import annotations

import hashlib
import logging
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any

from .config import Settings
from .features import Schema
from .jobs import DatabaseUnavailableError, JobStatus, JobStore, utcnow
from .registry import ModelRegistry
from .training import ModelType, train_model
from .validation import ValidatedDataset, validate_training_csv
from .webhook import deliver

log = logging.getLogger(__name__)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class TrainingService:
    def __init__(self, settings: Settings, schema: Schema, store: JobStore, registry: ModelRegistry):
        self.settings = settings
        self.schema = schema
        self.store = store
        self.registry = registry
        self._executor = ThreadPoolExecutor(max_workers=settings.training_workers, thread_name_prefix="trainer")
        self._futures: dict[str, Future[None]] = {}
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=False)

    # ---- submission --------------------------------------------------------

    def submit(
        self,
        content: bytes,
        *,
        filename: str | None,
        model_type: ModelType,
        alpha: float,
        callback_url: str | None,
        run_inline: bool = False,
    ) -> dict[str, Any]:
        """Validate synchronously, then queue the job. Raises DatasetValidationError or DatabaseUnavailableError."""
        dataset = validate_training_csv(content, self.schema, self.settings.min_training_rows)

        job_id = new_id("trn")
        upload = self.settings.uploads_dir / f"{job_id}.csv"
        upload.write_bytes(content)
        try:
            job = self.store.create(
                {
                    "id": job_id,
                    "status": JobStatus.submitted,
                    "model_type": model_type.value,
                    "alpha": alpha if model_type is ModelType.ridge else None,
                    "source_filename": filename,
                    "dataset_sha256": hashlib.sha256(content).hexdigest(),
                    "rows": dataset.rows,
                    "features": dataset.features,
                    "ignored_columns": dataset.ignored_columns,
                    "callback_url": callback_url,
                    "created_at": utcnow(),
                    "webhook_status": "pending" if callback_url else None,
                }
            )
        except DatabaseUnavailableError:
            upload.unlink(missing_ok=True)
            raise
        if run_inline:
            self._run(job_id, dataset)
        else:
            fut = self._executor.submit(self._run, job_id, dataset)
            self._futures[job_id] = fut
            fut.add_done_callback(lambda _f: self._futures.pop(job_id, None))
        return job

    def wait(self, job_id: str, timeout: float | None = None) -> None:
        """Block until a background job finishes (used by tests)."""
        fut = self._futures.get(job_id)
        if fut is not None:
            fut.result(timeout=timeout)

    # ---- execution ---------------------------------------------------------

    def _run(self, job_id: str, dataset: ValidatedDataset) -> None:
        try:
            self._train(job_id, dataset)
        except Exception as exc:  # noqa: BLE001 - every failure must end up on the job record
            log.exception("training job %s failed", job_id)
            try:
                self.store.update(
                    job_id, status=JobStatus.failed, error=f"{type(exc).__name__}: {exc}", finished_at=utcnow()
                )
            except DatabaseUnavailableError as db_exc:
                # The job stays "running" in the database; the next restart marks it as interrupted.
                log.error("could not record failure of job %s: %s", job_id, db_exc)
                return
        try:
            self._notify(job_id)
        except DatabaseUnavailableError as exc:
            log.error("could not send or record the webhook for job %s: %s", job_id, exc)

    def _train(self, job_id: str, dataset: ValidatedDataset) -> None:
        job = self.store.get(job_id)
        assert job is not None
        self.store.update(job_id, status=JobStatus.running, started_at=utcnow())

        model_type = ModelType(job["model_type"])
        result = train_model(dataset, model_type, alpha=job["alpha"] or 1.0)

        model_id = new_id("mdl")
        metadata = {
            "model_id": model_id,
            "training_id": job_id,
            "created_at": utcnow(),
            "model_type": model_type.value,
            "hyperparameters": {"alpha": job["alpha"]} if model_type is ModelType.ridge else {},
            "features": dataset.features,
            "target": dataset.target,
            "dataset": {
                "filename": job["source_filename"],
                "sha256": job["dataset_sha256"],
                "rows": dataset.rows,
                "ignored_columns": dataset.ignored_columns,
            },
            "coefficients": result.coefficients,
            "scaler": result.scaler,
            "metrics": result.metrics,
        }
        self.registry.save(model_id, result.pipeline, metadata)
        # The very first model goes live automatically; later ones are promoted via PUT /models/active.
        activated = self.registry.activate_if_none(model_id)
        self.store.update(
            job_id, status=JobStatus.succeeded, model_id=model_id, activated=activated, finished_at=utcnow()
        )

    def _notify(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if not job or not job["callback_url"]:
            return
        payload = {
            "event": f"training.{job['status']}",
            "training_id": job_id,
            "status": job["status"],
            "model_id": job["model_id"],
            "activated": job["activated"],
            "error": job["error"],
            "finished_at": job["finished_at"],
        }
        if job["model_id"]:
            payload["metrics"] = self.registry.metadata(job["model_id"])["metrics"]
        s = self.settings
        result = deliver(
            job["callback_url"],
            payload,
            secret=s.webhook_secret,
            timeout=s.webhook_timeout_seconds,
            max_attempts=s.webhook_max_attempts,
            backoff=s.webhook_backoff_seconds,
        )
        # A failed webhook never changes the training outcome; it is only recorded.
        self.store.update(
            job_id,
            webhook_status="delivered" if result.delivered else "failed",
            webhook_attempts=result.attempts,
            webhook_last_error=result.last_error,
        )

    # ---- bootstrap ---------------------------------------------------------

    def bootstrap(self) -> None:
        """Train and activate a model from the bundled dataset if no model exists yet."""
        path = self.settings.bootstrap_data_path
        if self.registry.list() or path is None:
            return
        if not path.is_file():
            log.warning("bootstrap dataset %s not found; starting without a model", path)
            return
        log.info("no models found; training initial model from %s", path)
        self.submit(
            path.read_bytes(),
            filename=path.name,
            model_type=ModelType(self.settings.bootstrap_model_type),
            alpha=self.settings.bootstrap_alpha,
            callback_url=None,
            run_inline=True,
        )
