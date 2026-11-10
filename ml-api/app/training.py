"""Model fitting and evaluation."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import numpy as np
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .validation import ValidatedDataset

MAX_CV_FOLDS = 5
RANDOM_STATE = 42


class ModelType(StrEnum):
    linear = "linear"
    ridge = "ridge"


@dataclass
class TrainingResult:
    pipeline: Pipeline
    coefficients: dict[str, Any]
    metrics: dict[str, Any]


def _build_pipeline(model_type: ModelType, alpha: float) -> Pipeline:
    regressor = Ridge(alpha=alpha) if model_type is ModelType.ridge else LinearRegression()
    return Pipeline([("scaler", StandardScaler()), ("regressor", regressor)])


def _scores(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "r2": round(float(r2_score(y_true, y_pred)), 4),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 2),
    }


def train_model(dataset: ValidatedDataset, model_type: ModelType, alpha: float = 1.0) -> TrainingResult:
    X = dataset.frame[dataset.features].to_numpy(dtype=float)
    y = dataset.frame[dataset.target].to_numpy(dtype=float)
    n = len(y)

    # Out-of-fold predictions pooled across folds: with small datasets per-fold
    # R² is unstable, so metrics are computed once over all held-out predictions.
    folds = max(2, min(MAX_CV_FOLDS, n // 2))
    cv = KFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
    oof = cross_val_predict(_build_pipeline(model_type, alpha), X, y, cv=cv)

    # The served model is fitted on all rows.
    pipeline = _build_pipeline(model_type, alpha)
    pipeline.fit(X, y)

    scaler: StandardScaler = pipeline.named_steps["scaler"]
    reg = pipeline.named_steps["regressor"]
    std_coef = np.asarray(reg.coef_, dtype=float)
    # Convert back to original units: price change per +1 unit of each feature.
    raw_coef = std_coef / scaler.scale_
    raw_intercept = float(reg.intercept_) - float(np.sum(raw_coef * scaler.mean_))

    coefficients = {
        "intercept": round(raw_intercept, 4),
        "per_unit": {f: round(float(c), 4) for f, c in zip(dataset.features, raw_coef, strict=True)},
        "standardized": {f: round(float(c), 4) for f, c in zip(dataset.features, std_coef, strict=True)},
        "standardized_intercept": round(float(reg.intercept_), 4),
    }
    metrics = {
        "training": _scores(y, pipeline.predict(X)),
        "cross_validation": {**_scores(y, oof), "folds": folds},
        "rows": n,
    }
    return TrainingResult(pipeline=pipeline, coefficients=coefficients, metrics=metrics)
