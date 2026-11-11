"""Test fixtures.

MongoDB is real: tests need MONGODB_URI (CI starts a mongo service container;
locally run `../scripts/with-secrets.sh pytest`). Each test session uses its own
throwaway collection, dropped afterwards; the real `estimates` collection is never touched.

ml-api is faked with httpx.MockTransport so predictions are deterministic and
outages can be simulated.
"""

import os
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

FEATURES = [
    {"name": "square_footage", "type": "float", "min": 100, "max": 20000, "description": "Area", "example": 1550},
    {"name": "bedrooms", "type": "int", "min": 0, "max": 20, "description": "Bedrooms", "example": 3},
    {"name": "bathrooms", "type": "float", "min": 0, "max": 20, "description": "Bathrooms", "example": 2},
    {"name": "year_built", "type": "int", "min": 1800, "max": 2100, "description": "Year", "example": 1997},
    {"name": "lot_size", "type": "float", "min": 0, "max": 1000000, "description": "Lot", "example": 6800},
    {"name": "distance_to_city_center", "type": "float", "min": 0, "max": 500, "description": "Dist", "example": 4.1},
    {"name": "school_rating", "type": "float", "min": 0, "max": 10, "description": "Rating", "example": 7.6},
]
HOUSE = {f["name"]: f["example"] for f in FEATURES}
NAMES = [f["name"] for f in FEATURES]

BASELINE = 264600.0
STD = dict(zip(NAMES, [30000, 8000, 7000, 9000, 25000, 15000, 18000], strict=True))
MEAN = dict(zip(NAMES, [1700, 3, 2, 1997, 7300, 4.8, 7.8], strict=True))
SCALE = dict(zip(NAMES, [400, 0.7, 0.6, 10, 1800, 1.9, 0.8], strict=True))


def fake_price(row: dict) -> float:
    return round(BASELINE + sum(STD[f] * (row[f] - MEAN[f]) / SCALE[f] for f in NAMES), 2)


class FakeMlApi:
    """Minimal stand-in for ml-api. Flip `down` / `no_model` to simulate failures."""

    def __init__(self):
        self.down = False
        self.no_model = False
        self.reject_predict = False
        self.model_id = "mdl_fake000001"
        self.calls: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(f"{request.method} {request.url.path}")
        if self.down:
            raise httpx.ConnectError("connection refused")
        path = request.url.path
        if path == "/features":
            return httpx.Response(200, json={"model_id": self.model_id, "target": "price", "features": FEATURES})
        if path == "/health":
            return httpx.Response(
                200, json={"status": "ok", "model_loaded": not self.no_model, "active_model_id": self.model_id}
            )
        if path == "/predict":
            if self.no_model:
                return httpx.Response(503, json={"detail": "no active model"})
            if self.reject_predict:
                return httpx.Response(422, json={"detail": {"message": "requires fields"}})
            rows = __import__("json").loads(request.content)
            return httpx.Response(
                200, json={"model_id": self.model_id, "count": len(rows), "predictions": [fake_price(r) for r in rows]}
            )
        if path == "/model-info":
            return httpx.Response(
                200,
                json={
                    "model_id": request.url.params["model_id"],
                    "model_type": "ridge",
                    "features": NAMES,
                    "coefficients": {"standardized": STD, "standardized_intercept": BASELINE},
                    "scaler": {"mean": MEAN, "scale": SCALE},
                },
            )
        return httpx.Response(404)


@pytest.fixture(scope="session")
def mongodb_uri() -> str:
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        pytest.skip("MONGODB_URI not set (locally: ../scripts/with-secrets.sh pytest)")
    return uri


@pytest.fixture
def fake_ml() -> FakeMlApi:
    return FakeMlApi()


@pytest.fixture
def client(mongodb_uri, fake_ml):
    settings = Settings(
        ml_api_url="http://ml-api",
        mongodb_uri=mongodb_uri,
        mongodb_db=os.environ.get("MONGODB_TEST_DB", "housing"),
        mongodb_collection=f"estimates_test_{uuid.uuid4().hex[:10]}",
        features_ttl_seconds=0,
    )
    http = httpx.AsyncClient(base_url="http://ml-api", transport=httpx.MockTransport(fake_ml.handler))
    app = create_app(settings, http_client=http)
    with TestClient(app) as c:
        try:
            yield c
        finally:
            c.portal.call(app.state.repo.drop)
            c.portal.call(http.aclose)
