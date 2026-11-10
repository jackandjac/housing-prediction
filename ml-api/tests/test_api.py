import csv
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.webhook import SIGNATURE_HEADER, sign

from .conftest import HOUSE, TEST_DATA, make_settings, wait_for


def upload(client, content: bytes, **form):
    return client.post("/trainings", files={"file": ("train.csv", content, "text/csv")}, data=form)


# ---- bootstrap / health / model-info ----------------------------------------------


def test_health_reports_bootstrapped_model(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["active_model_id"].startswith("mdl_")


def test_bootstrap_disabled_means_no_model(tmp_path):
    with TestClient(create_app(make_settings(tmp_path, bootstrap_data_path=None))) as c:
        assert c.get("/health").json()["model_loaded"] is False
        assert c.post("/predict", json=HOUSE).status_code == 503
        assert c.get("/model-info").status_code == 503


def test_model_info_has_coefficients_and_metrics(client):
    info = client.get("/model-info").json()
    assert info["is_active"] is True
    assert info["dataset"]["rows"] == 50
    assert info["dataset"]["ignored_columns"] == ["id"]  # BOM-prefixed header handled
    assert set(info["coefficients"]["per_unit"]) == set(HOUSE)
    assert info["metrics"]["cross_validation"]["folds"] == 5
    assert info["metrics"]["cross_validation"]["r2"] > 0.9


def test_per_unit_coefficients_reproduce_predictions(client):
    info = client.get("/model-info").json()
    c = info["coefficients"]
    manual = c["intercept"] + sum(c["per_unit"][k] * v for k, v in HOUSE.items())
    predicted = client.post("/predict", json=HOUSE).json()["predictions"][0]
    assert manual == pytest.approx(predicted, rel=1e-4)


# ---- prediction ----------------------------------------------------------------


def test_predict_single_and_batch(client):
    single = client.post("/predict", json=HOUSE).json()
    assert single["count"] == 1 and len(single["predictions"]) == 1

    with TEST_DATA.open(encoding="utf-8-sig") as fh:
        rows = [{k: float(v) for k, v in r.items()} for r in csv.DictReader(fh)]
    batch = client.post("/predict", json=rows).json()
    assert batch["count"] == 10
    assert all(100_000 < p < 600_000 for p in batch["predictions"])
    assert batch["predictions"][0] == pytest.approx(single["predictions"][0])  # same house as HOUSE


@pytest.mark.parametrize(
    "payload",
    [
        {**HOUSE, "bedrooms": -1},
        {**HOUSE, "school_rating": 11},
        {k: v for k, v in HOUSE.items() if k != "lot_size"},
        {**HOUSE, "unknown_field": 1},
        [],
    ],
)
def test_predict_rejects_invalid_input(client, payload):
    assert client.post("/predict", json=payload).status_code == 422


# ---- training lifecycle -----------------------------------------------------------


def test_training_lifecycle_and_switching_models(client, dataset_bytes):
    first_active = client.get("/health").json()["active_model_id"]

    resp = upload(client, dataset_bytes, model_type="ridge", alpha="0.5")
    assert resp.status_code == 202
    job = resp.json()
    assert job["status"] == "submitted"
    assert resp.headers["location"] == f"/trainings/{job['id']}"
    assert job["rows"] == 50 and job["ignored_columns"] == ["id"]

    done = wait_for(client, job["id"])
    assert done["status"] == "succeeded"
    assert done["started_at"] and done["finished_at"]
    new_model = done["model_id"]
    assert done["activated"] is False  # later models are not auto-activated
    assert client.get("/health").json()["active_model_id"] == first_active

    models = client.get("/models").json()
    assert [m["model_id"] for m in models][:2] == [new_model, first_active]
    assert [m["is_active"] for m in models][:2] == [False, True]

    info = client.get("/model-info", params={"model_id": new_model}).json()
    assert info["model_type"] == "ridge" and info["hyperparameters"] == {"alpha": 0.5}

    switched = client.put("/models/active", json={"model_id": new_model})
    assert switched.status_code == 200 and switched.json()["is_active"] is True
    assert client.post("/predict", json=HOUSE).json()["model_id"] == new_model

    assert any(t["id"] == job["id"] for t in client.get("/trainings").json())
    assert client.get("/trainings", params={"status": "succeeded"}).status_code == 200


def test_active_model_survives_restart(settings, dataset_bytes):
    with TestClient(create_app(settings)) as c:
        job = upload(c, dataset_bytes).json()
        new_model = wait_for(c, job["id"])["model_id"]
        c.put("/models/active", json={"model_id": new_model})
    with TestClient(create_app(settings)) as c:
        assert c.get("/health").json()["active_model_id"] == new_model
        assert len(c.get("/models").json()) == 2  # bootstrap did not run again


def test_unknown_ids(client):
    assert client.get("/trainings/trn_nope").status_code == 404
    assert client.get("/model-info", params={"model_id": "mdl_nope"}).status_code == 404
    assert client.put("/models/active", json={"model_id": "mdl_nope"}).status_code == 404
    assert client.put("/models/active", json={"model_id": "../trainings.db"}).status_code == 404


# ---- upload validation -------------------------------------------------------------


def _csv(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode()


def _base_rows(n: int = 12) -> list[dict]:
    return [{**HOUSE, "square_footage": 1000 + i * 100, "price": 150_000 + i * 10_000} for i in range(n)]


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        (b"", "empty"),
        (_csv([{k: v for k, v in r.items() if k != "price"} for r in _base_rows()]), "missing required column"),
        (_csv(_base_rows(5)), "at least 10"),
        (_csv([*_base_rows(), {**HOUSE, "price": "abc"}]), "non-numeric"),
        (_csv([*_base_rows(), {**HOUSE, "price": ""}]), "missing values"),
        (_csv([*_base_rows(), {**HOUSE, "school_rating": 12, "price": 1}]), "outside"),
        (_csv([*_base_rows(), {**HOUSE, "bedrooms": 2.5, "price": 1}]), "whole numbers"),
        (b"\xff\xfe\x00garbage", "UTF-8"),
    ],
)
def test_invalid_uploads_are_rejected_immediately(client, content, expected):
    resp = upload(client, content)
    assert resp.status_code == 422, resp.text
    detail = resp.json()["detail"]
    assert detail["message"] == "invalid training data"
    assert any(expected in e for e in detail["errors"]), detail
    assert client.get("/trainings").json()[0]["source_filename"] != "train.csv"  # nothing queued


def test_validation_reports_line_numbers(client):
    rows = _base_rows()
    rows[3]["price"] = "n/a"
    errors = upload(client, _csv(rows)).json()["detail"]["errors"]
    assert errors == ["column 'price': non-numeric values on line(s) 5"]


def test_upload_size_limit(tmp_path, dataset_bytes):
    with TestClient(create_app(make_settings(tmp_path, max_upload_bytes=100))) as c:
        assert upload(c, dataset_bytes).status_code == 413


def test_invalid_callback_url(client, dataset_bytes):
    assert upload(client, dataset_bytes, callback_url="ftp://example.com").status_code == 422


def test_empty_callback_url_is_ignored(client, dataset_bytes):
    resp = upload(client, dataset_bytes, callback_url="")
    assert resp.status_code == 202 and resp.json()["webhook_status"] is None


# ---- webhook ---------------------------------------------------------------------


class _Receiver:
    def __init__(self, fail_first: int = 0):
        self.calls: list[tuple[dict, dict]] = []
        self.fail_first = fail_first
        receiver = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802
                body = self.rfile.read(int(self.headers["Content-Length"]))
                receiver.calls.append((json.loads(body), dict(self.headers), body))
                code = 500 if len(receiver.calls) <= receiver.fail_first else 200
                self.send_response(code)
                self.end_headers()

            def log_message(self, *args):
                pass

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}/hook"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()


@pytest.fixture
def receiver():
    r = _Receiver()
    yield r
    r.close()


def test_webhook_delivered_on_success(client, dataset_bytes, receiver):
    job = upload(client, dataset_bytes, callback_url=receiver.url).json()
    assert job["webhook_status"] == "pending"
    done = wait_for(client, job["id"])
    assert done["webhook_status"] == "delivered" and done["webhook_attempts"] == 1

    payload, _headers, _ = receiver.calls[0]
    assert payload["event"] == "training.succeeded"
    assert payload["training_id"] == job["id"]
    assert payload["model_id"] == done["model_id"]
    assert "cross_validation" in payload["metrics"]


def test_webhook_signed_and_retried(tmp_path, dataset_bytes):
    r = _Receiver(fail_first=1)
    try:
        with TestClient(create_app(make_settings(tmp_path, webhook_secret="s3cret"))) as c:
            job = upload(c, dataset_bytes, callback_url=r.url).json()
            done = wait_for(c, job["id"])
        assert done["webhook_status"] == "delivered" and done["webhook_attempts"] == 2
        _payload, headers, raw = r.calls[-1]
        assert headers[SIGNATURE_HEADER] == sign(raw, "s3cret")
    finally:
        r.close()


def test_webhook_failure_does_not_fail_training(tmp_path, dataset_bytes):
    with TestClient(create_app(make_settings(tmp_path, webhook_max_attempts=2))) as c:
        job = upload(c, dataset_bytes, callback_url="http://127.0.0.1:9/unreachable").json()
        done = wait_for(c, job["id"])
    assert done["status"] == "succeeded"
    assert done["webhook_status"] == "failed" and done["webhook_attempts"] == 2
    assert done["webhook_last_error"]


# ---- schema evolution ---------------------------------------------------------------


def test_new_optional_feature_can_be_added(tmp_path, dataset_bytes):
    """Adding a field to features.yaml requires no code changes."""
    import yaml

    from app.config import APP_ROOT

    spec = yaml.safe_load((APP_ROOT / "features.yaml").read_text())
    spec["features"].append(
        {"name": "garage_spaces", "type": "int", "min": 0, "max": 10, "required": False, "example": 1}
    )
    features_path = Path(tmp_path) / "features.yaml"
    features_path.write_text(yaml.safe_dump(spec))

    with TestClient(create_app(make_settings(tmp_path, features_path=features_path))) as c:
        old_model = c.get("/health").json()["active_model_id"]
        # Old model (no garage_spaces) still predicts without the new field.
        assert c.post("/predict", json=HOUSE).status_code == 200

        rows = list(csv.DictReader(io.StringIO(dataset_bytes.decode("utf-8-sig"))))
        for i, row in enumerate(rows):
            row["garage_spaces"] = str(i % 3)
        job = upload(c, _csv(rows)).json()
        assert "garage_spaces" in job["features"]
        new_model = wait_for(c, job["id"])["model_id"]
        c.put("/models/active", json={"model_id": new_model})

        missing = c.post("/predict", json=HOUSE)
        assert missing.status_code == 422
        assert missing.json()["detail"]["errors"] == [{"index": 0, "missing": ["garage_spaces"]}]
        assert c.post("/predict", json={**HOUSE, "garage_spaces": 2}).status_code == 200

        # Switching back to the old model works.
        assert c.put("/models/active", json={"model_id": old_model}).status_code == 200
        assert c.post("/predict", json=HOUSE).status_code == 200
