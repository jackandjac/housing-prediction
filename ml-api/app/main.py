"""FastAPI application.

Run with:  uvicorn app.main:create_app --factory
Use a single worker: the active model is held in process memory.

No `from __future__ import annotations` here: FastAPI must resolve the
locally built HouseFeatures type at runtime.
"""

import logging
from contextlib import asynccontextmanager
from typing import Annotated, Any
from urllib.parse import urlparse

from fastapi import Body, FastAPI, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from .config import Settings
from .features import build_request_model, load_schema
from .jobs import JobStatus, JobStore
from .registry import ModelIncompatibleError, ModelNotFoundError, ModelRegistry
from .schemas import (
    ActivateModelRequest,
    HealthResponse,
    ModelInfo,
    ModelSummary,
    PredictionResponse,
    TrainingJob,
    ValidationErrorResponse,
)
from .service import TrainingService
from .training import ModelType
from .validation import DatasetValidationError

log = logging.getLogger("ml_api")

# Second row of data/Test_Data_For_Prediction.csv; used in the Swagger batch example.
BATCH_EXAMPLE_EXTRA = {
    "square_footage": 2200,
    "bedrooms": 4,
    "bathrooms": 2.5,
    "year_built": 2008,
    "lot_size": 9600,
    "distance_to_city_center": 7.0,
    "school_rating": 8.8,
}

TAGS = [
    {"name": "training", "description": "Upload a dataset and train a model in the background."},
    {"name": "models", "description": "List trained models and choose which one serves predictions."},
    {"name": "prediction", "description": "Predict prices with the active model."},
    {"name": "ops", "description": "Health checks."},
]


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    schema = load_schema(settings.features_path)
    HouseFeatures = build_request_model(schema)
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    store = JobStore(settings.db_path)
    registry = ModelRegistry(settings.models_dir, settings.active_pointer_path, schema)
    service = TrainingService(settings, schema, store, registry)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        interrupted = store.fail_interrupted()
        if interrupted:
            log.warning("marked %d interrupted training job(s) as failed", interrupted)
        try:
            registry.restore_active()
        except (ModelNotFoundError, ModelIncompatibleError) as exc:
            log.error("could not restore active model: %s", exc)
        service.bootstrap()
        yield
        service.shutdown()
        store.close()

    app = FastAPI(
        title="Housing Price Prediction API",
        version="1.0.0",
        description=(
            "Train regression models on uploaded housing data and serve price predictions.\n\n"
            "**Typical flow:** `POST /trainings` → poll `GET /trainings/{id}` (or receive the webhook) → "
            "`GET /models` → `PUT /models/active` → `POST /predict`."
        ),
        openapi_tags=TAGS,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.service = service
    app.state.registry = registry

    def model_info(model_id: str) -> dict[str, Any]:
        meta = registry.metadata(model_id)
        active = registry.active
        return {**meta, "is_active": active is not None and active.model_id == model_id}

    # ---- training ----------------------------------------------------------

    @app.post(
        "/trainings",
        tags=["training"],
        status_code=status.HTTP_202_ACCEPTED,
        response_model=TrainingJob,
        summary="Upload a training CSV and start training",
        responses={
            413: {"description": "File too large"},
            422: {"model": ValidationErrorResponse, "description": "Invalid training data"},
        },
    )
    async def submit_training(
        response: Response,
        file: Annotated[UploadFile, File(description="CSV with the feature columns and the target column")],
        model_type: Annotated[ModelType, Form()] = ModelType.linear,
        alpha: Annotated[float, Form(gt=0, description="Regularisation strength (ridge only)")] = 1.0,
        callback_url: Annotated[
            str | None, Form(description="Optional http(s) URL that receives a POST when training finishes")
        ] = None,
    ) -> dict[str, Any]:
        """The file is validated before this returns. If it is valid the job is queued and
        **202** is returned with `status: submitted`; track it with `GET /trainings/{id}`
        or via `callback_url`."""
        callback_url = (callback_url or "").strip() or None
        if callback_url:
            parsed = urlparse(callback_url)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise HTTPException(
                    422, {"message": "invalid callback_url", "errors": ["callback_url must be an absolute http(s) URL"]}
                )

        content = await file.read(settings.max_upload_bytes + 1)
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(413, f"file exceeds {settings.max_upload_bytes} bytes")

        try:
            job = await run_in_threadpool(
                service.submit,
                content,
                filename=file.filename,
                model_type=model_type,
                alpha=alpha,
                callback_url=callback_url,
            )
        except DatasetValidationError as exc:
            raise HTTPException(422, {"message": "invalid training data", "errors": exc.errors}) from None

        response.headers["Location"] = f"/trainings/{job['id']}"
        return job

    @app.get("/trainings", tags=["training"], response_model=list[TrainingJob], summary="List training jobs")
    def list_trainings(
        status_filter: Annotated[JobStatus | None, Query(alias="status")] = None,
        limit: Annotated[int, Query(ge=1, le=500)] = 100,
    ) -> list[dict[str, Any]]:
        return store.list(limit=limit, status=status_filter)

    @app.get(
        "/trainings/{training_id}",
        tags=["training"],
        response_model=TrainingJob,
        summary="Get the status of a training job",
        responses={404: {"description": "Unknown training id"}},
    )
    def get_training(training_id: str) -> dict[str, Any]:
        job = store.get(training_id)
        if job is None:
            raise HTTPException(404, f"training {training_id!r} not found")
        return job

    # ---- models ------------------------------------------------------------

    @app.get("/models", tags=["models"], response_model=list[ModelSummary], summary="List trained models")
    def list_models() -> list[dict[str, Any]]:
        active = registry.active
        return [{**m, "is_active": active is not None and active.model_id == m["model_id"]} for m in registry.list()]

    @app.put(
        "/models/active",
        tags=["models"],
        response_model=ModelInfo,
        summary="Change the model used for predictions",
        responses={
            404: {"description": "Unknown model id"},
            409: {"description": "Model is not compatible with the current feature schema"},
        },
    )
    def set_active_model(body: ActivateModelRequest) -> dict[str, Any]:
        try:
            registry.activate(body.model_id)
        except ModelNotFoundError:
            raise HTTPException(404, f"model {body.model_id!r} not found") from None
        except ModelIncompatibleError as exc:
            raise HTTPException(409, str(exc)) from None
        log.info("active model set to %s", body.model_id)
        return model_info(body.model_id)

    @app.get(
        "/model-info",
        tags=["models"],
        response_model=ModelInfo,
        summary="Coefficients and performance metrics",
        responses={404: {"description": "Unknown model id"}, 503: {"description": "No active model"}},
    )
    def get_model_info(
        model_id: Annotated[str | None, Query(description="Defaults to the active model")] = None,
    ) -> dict[str, Any]:
        """Metrics include `training` (fit on all rows) and `cross_validation`
        (pooled out-of-fold predictions — the honest estimate of accuracy on new data)."""
        if model_id is None:
            active = registry.active
            if active is None:
                raise HTTPException(503, "no active model")
            model_id = active.model_id
        try:
            return model_info(model_id)
        except ModelNotFoundError:
            raise HTTPException(404, f"model {model_id!r} not found") from None

    # ---- prediction --------------------------------------------------------

    single_example = schema.example()

    @app.post(
        "/predict",
        tags=["prediction"],
        response_model=PredictionResponse,
        summary="Predict prices for one house or a batch",
        responses={503: {"description": "No active model"}},
    )
    def predict(
        payload: Annotated[
            HouseFeatures | list[HouseFeatures],  # type: ignore[valid-type]
            Body(
                openapi_examples={
                    "single": {"summary": "Single house", "value": single_example},
                    "batch": {
                        "summary": "Batch of houses",
                        "value": [
                            single_example,
                            {**single_example, **{k: v for k, v in BATCH_EXAMPLE_EXTRA.items() if k in single_example}},
                        ],
                    },
                }
            ),
        ],
    ) -> dict[str, Any]:
        """Send one JSON object for a single prediction or an array for a batch.
        The response always contains a `predictions` list in input order."""
        model = registry.active
        if model is None:
            raise HTTPException(503, "no active model; train one with POST /trainings")
        items = payload if isinstance(payload, list) else [payload]
        if not items:
            raise HTTPException(422, "batch is empty")
        if len(items) > settings.max_batch_size:
            raise HTTPException(422, f"batch exceeds {settings.max_batch_size} items")

        rows = [item.model_dump() for item in items]
        errors = [
            {"index": i, "missing": missing}
            for i, row in enumerate(rows)
            if (missing := [f for f in model.features if row.get(f) is None])
        ]
        if errors:
            raise HTTPException(
                422, {"message": f"active model {model.model_id} requires these fields", "errors": errors}
            )
        return {"model_id": model.model_id, "count": len(rows), "predictions": model.predict(rows)}

    # ---- ops ---------------------------------------------------------------

    @app.get("/health", tags=["ops"], response_model=HealthResponse, summary="Health check")
    def health() -> dict[str, Any]:
        active = registry.active
        return {
            "status": "ok",
            "model_loaded": active is not None,
            "active_model_id": active.model_id if active else None,
        }

    return app
