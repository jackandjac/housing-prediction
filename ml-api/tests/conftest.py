"""Test fixtures.

MongoDB is real: tests need MONGODB_URI (CI starts a mongo service container; locally run
`docker run -d -p 27017:27017 mongo:7.0` or use ../scripts/with-secrets.sh pytest). Each test gets its
own collection, dropped afterwards. Without MONGODB_URI the tests are skipped, except on CI where that
is an error, so a misconfigured workflow cannot pass by skipping everything.
"""

import os
import uuid
import warnings
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config import APP_ROOT, Settings
from app.jobs import redact
from app.main import create_app

warnings.filterwarnings("ignore", message=".*httpx2.*")

REPO_DATA = APP_ROOT.parent / "data"
DATASET = REPO_DATA / "House_Price_Dataset.csv"
TEST_DATA = REPO_DATA / "Test_Data_For_Prediction.csv"

HOUSE = {
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6,
}


MONGODB_URI = os.environ.get("MONGODB_URI", "")
MONGODB_TEST_DB = os.environ.get("MONGODB_TEST_DB", "housing")
_collection: str | None = None  # set per test by the autouse fixture below


@pytest.fixture(autouse=True)
def trainings_collection():
    """A fresh collection for every test; dropped afterwards (also when the test fails)."""
    global _collection
    if not MONGODB_URI:
        if os.environ.get("CI"):
            pytest.fail("MONGODB_URI must be set on CI")
        pytest.skip("MONGODB_URI not set (locally: docker run -d -p 27017:27017 mongo:7.0)")
    _collection = f"trainings_test_{uuid.uuid4().hex[:10]}"
    yield _collection
    try:
        with MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000) as mc:
            mc[MONGODB_TEST_DB].drop_collection(_collection)
    except Exception as exc:  # noqa: BLE001 - never leak the URI in a teardown traceback
        warnings.warn(f"could not drop {_collection}: {redact(exc)}", stacklevel=1)
    _collection = None


def make_settings(tmp_path: Path, **overrides) -> Settings:
    base = dict(
        mongodb_uri=MONGODB_URI,
        mongodb_db=MONGODB_TEST_DB,
        mongodb_trainings_collection=_collection,
        data_dir=tmp_path / "data",
        features_path=APP_ROOT / "features.yaml",
        bootstrap_data_path=DATASET,
        webhook_backoff_seconds=0.01,
        webhook_timeout_seconds=2,
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
def settings(tmp_path):
    return make_settings(tmp_path)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def dataset_bytes() -> bytes:
    return DATASET.read_bytes()


def wait_for(client: TestClient, training_id: str, timeout: float = 10) -> dict:
    client.app.state.service.wait(training_id, timeout=timeout)
    return client.get(f"/trainings/{training_id}").json()
