"""Server-side input validation and the price breakdown. Pure functions, no I/O."""

from __future__ import annotations

from typing import Any


def validate_inputs(
    values: dict[str, Any], fields: list[dict[str, Any]]
) -> tuple[dict[str, float], list[dict[str, str]]]:
    """Check submitted values against the active model's field specs.

    Returns (clean values in model order, field errors). The same rules drive
    the portal's client-side validation, so both sides agree.
    """
    errors: list[dict[str, str]] = []
    clean: dict[str, float] = {}
    known = {f["name"] for f in fields}

    for name in values:
        if name not in known:
            errors.append({"field": name, "message": "is not an input of the current model"})

    for spec in fields:
        name = spec["name"]
        raw = values.get(name)
        if raw is None or raw == "":
            errors.append({"field": name, "message": "is required"})
            continue
        if isinstance(raw, bool):
            errors.append({"field": name, "message": "must be a number"})
            continue
        try:
            number = float(raw)
        except (TypeError, ValueError):
            errors.append({"field": name, "message": "must be a number"})
            continue
        if number != number or number in (float("inf"), float("-inf")):
            errors.append({"field": name, "message": "must be a finite number"})
            continue
        if spec.get("type") == "int" and not number.is_integer():
            errors.append({"field": name, "message": "must be a whole number"})
            continue
        lo, hi = spec.get("min"), spec.get("max")
        if lo is not None and number < lo:
            errors.append({"field": name, "message": f"must be at least {_fmt(lo)}"})
            continue
        if hi is not None and number > hi:
            errors.append({"field": name, "message": f"must be at most {_fmt(hi)}"})
            continue
        clean[name] = int(number) if spec.get("type") == "int" else number

    return clean, errors


def _fmt(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else str(n)


def breakdown(inputs: dict[str, float], model_info: dict[str, Any]) -> dict[str, Any] | None:
    """Split a prediction into the average training price plus one contribution per feature.

    contribution_i = standardized_coef_i * (x_i - mean_i) / scale_i
    baseline + sum(contributions) equals the model's prediction exactly.
    Returns None for models trained before scaler stats were recorded.
    """
    scaler = model_info.get("scaler")
    coefs = model_info.get("coefficients", {})
    if not scaler or "standardized" not in coefs:
        return None
    contributions = []
    for name in model_info["features"]:
        scale = scaler["scale"][name] or 1.0
        value = inputs[name]
        contributions.append(
            {
                "feature": name,
                "value": value,
                "average": round(scaler["mean"][name], 4),
                "contribution": round(coefs["standardized"][name] * (value - scaler["mean"][name]) / scale, 2),
            }
        )
    contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)
    return {"baseline": round(coefs["standardized_intercept"], 2), "contributions": contributions}
