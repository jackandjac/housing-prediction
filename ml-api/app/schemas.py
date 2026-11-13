"""Response and request models that don't depend on the feature schema."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .jobs import JobStatus


class TrainingJob(BaseModel):
    id: str
    status: JobStatus
    model_type: str
    alpha: float | None
    source_filename: str | None
    dataset_sha256: str
    rows: int
    features: list[str]
    ignored_columns: list[str]
    callback_url: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    error: str | None
    model_id: str | None = Field(description="Set once the job has succeeded")
    activated: bool = Field(description="True if this job's model was made active automatically")
    webhook_status: str | None = Field(description="pending | delivered | failed; null without callback_url")
    webhook_attempts: int
    webhook_last_error: str | None


class ModelSummary(BaseModel):
    model_id: str
    training_id: str
    created_at: str
    model_type: str
    features: list[str]
    dataset: dict[str, Any]
    metrics: dict[str, Any]
    is_active: bool


class ModelInfo(ModelSummary):
    target: str
    hyperparameters: dict[str, Any]
    coefficients: dict[str, Any] = Field(
        description="`per_unit`: price change per +1 unit of each feature (with `intercept`). "
        "`standardized`: change per +1 standard deviation, comparable across features."
    )
    scaler: dict[str, dict[str, float]] | None = Field(
        default=None,
        description="Training mean and standard deviation per feature. Contribution of feature i to a "
        "prediction = standardized[i] * (x_i - mean[i]) / scale[i]; these sum, with "
        "`standardized_intercept` (the mean training price), to the prediction. Null for older models.",
    )


class FeatureField(BaseModel):
    name: str
    type: str = Field(description="float | int")
    min: float | None
    max: float | None
    description: str
    example: float | None


class FeaturesResponse(BaseModel):
    model_id: str | None = Field(description="Active model; null when no model is loaded")
    target: str
    features: list[FeatureField] = Field(
        description="Inputs the active model needs, in model order. Without an active model: the schema's "
        "required features."
    )


class ActivateModelRequest(BaseModel):
    model_id: str = Field(examples=["mdl_0123456789ab"])


class PredictionResponse(BaseModel):
    model_id: str
    count: int
    predictions: list[float] = Field(description="Predicted prices, in the same order as the input")


class HealthResponse(BaseModel):
    status: str = Field(description="ok | degraded (MongoDB unreachable: predictions work, training does not)")
    database: str = Field(description="ok | unreachable")
    model_loaded: bool
    active_model_id: str | None


class ValidationErrorResponse(BaseModel):
    detail: dict[str, Any] = Field(
        examples=[{"message": "invalid training data", "errors": ["missing required column(s): price"]}]
    )
