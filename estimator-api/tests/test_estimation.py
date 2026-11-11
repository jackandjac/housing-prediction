"""Unit tests for the pure validation and breakdown logic (no database needed)."""

import pytest

from app.estimation import breakdown, validate_inputs
from app.repository import redact

from .conftest import BASELINE, FEATURES, HOUSE, MEAN, NAMES, SCALE, STD, fake_price


def test_valid_inputs_are_cleaned_in_model_order():
    clean, errors = validate_inputs({**HOUSE, "bedrooms": "3"}, FEATURES)
    assert errors == []
    assert list(clean) == NAMES
    assert clean["bedrooms"] == 3 and isinstance(clean["bedrooms"], int)


@pytest.mark.parametrize(
    ("change", "field", "message"),
    [
        ({"bedrooms": None}, "bedrooms", "is required"),
        ({"bedrooms": ""}, "bedrooms", "is required"),
        ({"bedrooms": 2.5}, "bedrooms", "must be a whole number"),
        ({"school_rating": 11}, "school_rating", "must be at most 10"),
        ({"square_footage": 50}, "square_footage", "must be at least 100"),
        ({"lot_size": "big"}, "lot_size", "must be a number"),
        ({"lot_size": True}, "lot_size", "must be a number"),
        ({"garage": 1}, "garage", "is not an input of the current model"),
    ],
)
def test_invalid_inputs_report_field_errors(change, field, message):
    values = {**HOUSE, **change}
    _clean, errors = validate_inputs(values, FEATURES)
    assert {"field": field, "message": message} in errors


def test_missing_field_reported():
    values = {k: v for k, v in HOUSE.items() if k != "year_built"}
    _clean, errors = validate_inputs(values, FEATURES)
    assert errors == [{"field": "year_built", "message": "is required"}]


def test_breakdown_sums_to_prediction():
    info = {
        "features": NAMES,
        "coefficients": {"standardized": STD, "standardized_intercept": BASELINE},
        "scaler": {"mean": MEAN, "scale": SCALE},
    }
    result = breakdown(HOUSE, info)
    assert result["baseline"] == BASELINE
    total = result["baseline"] + sum(c["contribution"] for c in result["contributions"])
    assert total == pytest.approx(fake_price(HOUSE), abs=0.1)
    sizes = [abs(c["contribution"]) for c in result["contributions"]]
    assert sizes == sorted(sizes, reverse=True)


def test_breakdown_missing_for_old_models():
    assert breakdown(HOUSE, {"features": NAMES, "coefficients": {"per_unit": {}}}) is None


def test_redact_hides_credentials():
    msg = "could not connect to mongodb+srv://user:s3cret@cluster0.example.net/?x=1"
    assert "s3cret" not in redact(msg) and "user" not in redact(msg)
