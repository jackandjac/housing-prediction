"""API tests against a real MongoDB (throwaway collection) and a fake ml-api."""

import pytest

from .conftest import HOUSE, fake_price


def create(client, **overrides):
    body = {"features": HOUSE, **overrides}
    return client.post("/estimates", json=body)


def test_form_schema_has_display_hints(client):
    body = client.get("/form-schema").json()
    assert body["model_id"] == "mdl_fake000001"
    sqft = body["fields"][0]
    assert sqft["name"] == "square_footage" and sqft["label"] == "Living area" and sqft["unit"] == "sq ft"
    baths = next(f for f in body["fields"] if f["name"] == "bathrooms")
    assert baths["step"] == 0.5


def test_create_estimate_returns_price_breakdown_and_location(client):
    resp = create(client, label="  12 Maple St ")
    assert resp.status_code == 201, resp.text
    est = resp.json()
    assert resp.headers["location"] == f"/estimates/{est['id']}"
    assert est["label"] == "12 Maple St"
    assert est["predicted_price"] == fake_price(HOUSE)
    assert est["model_id"] == "mdl_fake000001" and est["model_type"] == "ridge"
    contrib = est["breakdown"]["contributions"]
    assert est["breakdown"]["baseline"] + sum(c["contribution"] for c in contrib) == pytest.approx(
        est["predicted_price"], abs=0.1
    )


def test_invalid_estimate_returns_field_errors_and_is_not_saved(client):
    resp = create(client, features={**HOUSE, "school_rating": 12, "bedrooms": 1.5})
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["message"] == "Some property details are invalid."
    assert {e["field"] for e in detail["errors"]} == {"school_rating", "bedrooms"}
    assert client.get("/estimates").json()["total"] == 0


def test_malformed_body_uses_same_error_shape(client):
    resp = client.post("/estimates", json={"label": "x" * 100, "features": HOUSE})
    assert resp.status_code == 422
    assert resp.json()["detail"]["errors"][0]["field"] == "label"


def test_history_is_newest_first_and_paginated(client):
    ids = [create(client, label=f"house {i}").json()["id"] for i in range(3)]
    page = client.get("/estimates", params={"limit": 2}).json()
    assert page["total"] == 3 and [e["id"] for e in page["items"]] == ids[::-1][:2]
    rest = client.get("/estimates", params={"limit": 2, "offset": 2}).json()
    assert [e["id"] for e in rest["items"]] == [ids[0]]


def test_get_and_delete(client):
    est = create(client).json()
    assert client.get(f"/estimates/{est['id']}").json()["id"] == est["id"]
    assert client.delete(f"/estimates/{est['id']}").status_code == 204
    assert client.get(f"/estimates/{est['id']}").status_code == 404
    assert client.delete(f"/estimates/{est['id']}").status_code == 404


@pytest.mark.parametrize("bad_id", ["not-an-objectid", "123", "ffffffffffffffffffffffff"])
def test_unknown_or_malformed_ids_are_404(client, bad_id):
    assert client.get(f"/estimates/{bad_id}").status_code == 404
    assert client.delete(f"/estimates/{bad_id}").status_code == 404


def test_compare(client):
    small = create(client, label="small", features={**HOUSE, "square_footage": 1100}).json()
    big = create(client, label="big", features={**HOUSE, "square_footage": 2400}).json()
    body = client.get("/estimates/compare", params={"ids": f"{big['id']},{small['id']}"}).json()
    assert [e["label"] for e in body["items"]] == ["big", "small"]  # order preserved
    assert body["cheapest_id"] == small["id"] and body["most_expensive_id"] == big["id"]
    assert body["features"][0] == "square_footage"


def test_compare_limits_and_missing(client):
    one = create(client).json()["id"]
    assert client.get("/estimates/compare", params={"ids": one}).status_code == 422
    assert client.get("/estimates/compare", params={"ids": f"{one},{one}"}).status_code == 422  # duplicates
    assert client.get("/estimates/compare", params={"ids": ",".join([one] + ["a"] * 4)}).status_code in (404, 422)
    missing = client.get("/estimates/compare", params={"ids": f"{one},ffffffffffffffffffffffff"})
    assert missing.status_code == 404
    assert missing.json()["detail"]["errors"] == [{"field": "ffffffffffffffffffffffff", "message": "not found"}]


def test_ml_api_down_gives_clear_503(client, fake_ml):
    fake_ml.down = True
    resp = create(client)
    assert resp.status_code == 503
    assert resp.json()["detail"]["message"] == "Estimates are unavailable: the prediction service is unreachable."
    health = client.get("/health").json()
    assert health["status"] == "degraded" and health["ml_api"] == "unreachable" and health["database"] == "ok"


def test_ml_api_without_model_gives_503(client, fake_ml):
    fake_ml.no_model = True
    assert create(client).status_code == 503
    assert client.get("/health").json()["ml_api"] == "no_model"


def test_model_changed_mid_request_gives_422(client, fake_ml):
    fake_ml.reject_predict = True
    resp = create(client)
    assert resp.status_code == 422 and "Reload the form" in resp.json()["detail"]["message"]


def test_health_ok(client):
    assert client.get("/health").json() == {
        "status": "ok",
        "database": "ok",
        "ml_api": "ok",
        "active_model_id": "mdl_fake000001",
    }
