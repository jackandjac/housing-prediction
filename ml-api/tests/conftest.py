import warnings
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import APP_ROOT, Settings
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


def make_settings(tmp_path: Path, **overrides) -> Settings:
    base = dict(
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
