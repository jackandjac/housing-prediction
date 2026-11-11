"""Request and response models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class FormField(BaseModel):
    name: str
    label: str
    type: str = Field(description="float | int")
    min: float | None
    max: float | None
    step: float
    unit: str | None
    description: str
    example: float | None


class FormSchema(BaseModel):
    model_id: str | None
    fields: list[FormField]


class EstimateRequest(BaseModel):
    label: str | None = Field(
        default=None, max_length=80, description="Optional name for this property, e.g. '12 Maple St'"
    )
    features: dict[str, float | int | str | None] = Field(
        description="Feature name to value. Fields and rules come from GET /form-schema.",
        examples=[
            {
                "square_footage": 1550,
                "bedrooms": 3,
                "bathrooms": 2,
                "year_built": 1997,
                "lot_size": 6800,
                "distance_to_city_center": 4.1,
                "school_rating": 7.6,
            }
        ],
    )


class Contribution(BaseModel):
    feature: str
    value: float
    average: float = Field(description="Average value in the training data")
    contribution: float = Field(description="Dollars this feature adds to (or removes from) the baseline")


class Breakdown(BaseModel):
    baseline: float = Field(description="Average price in the training data")
    contributions: list[Contribution] = Field(description="Largest effect first")


class Estimate(BaseModel):
    id: str
    label: str | None
    inputs: dict[str, float]
    predicted_price: float
    model_id: str
    model_type: str | None
    breakdown: Breakdown | None = Field(description="Null for models without scaler statistics")
    created_at: datetime


class EstimatePage(BaseModel):
    items: list[Estimate]
    total: int
    limit: int
    offset: int


class Comparison(BaseModel):
    items: list[Estimate]
    features: list[str] = Field(description="Union of input fields across the compared estimates, in order")
    cheapest_id: str
    most_expensive_id: str


class FieldError(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    message: str
    errors: list[FieldError] = []


class ErrorResponse(BaseModel):
    detail: ErrorBody


class Health(BaseModel):
    status: str = Field(description="ok | degraded")
    database: str
    ml_api: str
    active_model_id: str | None
