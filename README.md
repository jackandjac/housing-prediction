# Housing Price Prediction

Monorepo for the full-stack interview tasks.

| Path | What | Status |
|---|---|---|
| [`ml-api/`](ml-api/) | **Task 1**: FastAPI + scikit-learn regression API with async training, a model registry and webhooks | ✅ |
| `estimator-api/`, `market-api/`, `portal/` | **Task 2**: Next.js portal with Python and Java backends | planned |
| [`data/`](data/) | `House_Price_Dataset.csv` (training data) and `Test_Data_For_Prediction.csv` (unlabelled rows to predict) | |

---

## Task 1: ML API

### Run it

```bash
# Pre-built image from GitHub Actions (amd64 + arm64)
docker run --rm -p 8000:8000 -v ml-data:/data ghcr.io/jackandjac/housing-prediction-ml-api:latest

# or build locally (from the repo root)
docker build -f ml-api/Dockerfile -t housing-ml-api .
docker run --rm -p 8000:8000 -v ml-data:/data housing-ml-api
```

Open **http://localhost:8000/docs** for Swagger UI.

On first start, the API trains a Ridge model (alpha=1) from the bundled `House_Price_Dataset.csv` and makes it active, so `/predict` works straight away. Models, uploads and job history are kept in the `/data` volume and survive restarts.

#### Live demo in GitHub Codespaces

1. On the repo page click **Code → Codespaces → Create codespace on main**.
2. Wait 2–3 minutes. The first start installs dependencies, then `.devcontainer/start-api.sh` starts the API, and Swagger opens in a new tab.
3. To share it, open the **PORTS** tab, right-click port **8000**, and choose **Port Visibility → Public**. The start script tries to do this for you. The URL looks like `https://<codespace-name>-8000.app.github.dev/docs`.

Notes:
- The Codespace stops after 30 minutes without activity. You can raise the timeout to 4 hours at github.com/settings/codespaces.
- Reopening a stopped Codespace restarts the API automatically, with trained models kept.
- Logs: `tail -f /tmp/ml-api.log`. Restart by hand: `bash .devcontainer/start-api.sh`.
- For the webhook demo, run `python ml-api/scripts/webhook_receiver.py` in a terminal and use `callback_url=http://localhost:9000/hook`.

<details>
<summary>Without Docker</summary>

```bash
cd ml-api
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:create_app --factory --reload
pytest
```
</details>

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/trainings` | Upload a CSV (multipart `file`) with optional `model_type` (`linear`/`ridge`), `alpha` and `callback_url`. The file is validated **synchronously**: if it's invalid you get **422** listing every problem with line numbers; if it's valid the job is queued and you get **202** `status: submitted` with a `Location` header. |
| `GET` | `/trainings/{id}` | Poll a job: `submitted → running → succeeded / failed`, plus `model_id` and webhook delivery status |
| `GET` | `/trainings` | List jobs (`?status=`, `?limit=`) |
| `GET` | `/models` | List all trained models with metrics and `is_active` |
| `PUT` | `/models/active` | `{"model_id": "..."}` switches the model that serves predictions |
| `POST` | `/predict` | One JSON object or an array (batch, up to 1000). Always returns `predictions` in input order. |
| `GET` | `/model-info` | Coefficients, metrics and per-feature scaler stats of the active model (`?model_id=` for any other model) |
| `GET` | `/features` | The input fields the active model needs, with type, range and description. Clients build forms and validation from it. |
| `GET` | `/health` | Liveness check, plus whether a model is loaded |

### Demo script

1. `POST /predict` with the **single** example, then the **batch** example (or the rows of `data/Test_Data_For_Prediction.csv`).
2. `GET /model-info`: show the coefficients and the cross-validated metrics.
3. Start the webhook receiver: `python ml-api/scripts/webhook_receiver.py` (port 9000).
4. `POST /trainings` with `House_Price_Dataset.csv`, `model_type=ridge` and `callback_url=http://host.docker.internal:9000/hook` (or `http://localhost:9000/hook` without Docker). You get 202 straight away, and the receiver prints the webhook a moment later.
5. `GET /trainings/{id}`, `GET /models`, then `PUT /models/active` with the new id. `/predict` now reports the new `model_id`.
6. Upload a broken CSV and get 422 with the problems listed.

### Design notes

- **Training is separate from serving.** Training runs in a background worker pool and never blocks prediction requests. Each model is saved as `models/<id>/model.joblib` plus `metadata.json`, which records the features, the dataset's SHA-256, coefficients and metrics, so you can always trace which data produced the model that's serving.
- **Promotion is explicit.** Only the very first model is activated automatically. Later models are listed and must be promoted with `PUT /models/active`, so training never changes production predictions on its own. The active model is swapped atomically in memory, and the choice is written to disk so it survives restarts.
- **Webhooks.** When a job finishes, the API sends `POST callback_url` with the event, ids and metrics. Failed deliveries are retried with exponential backoff (3 attempts). Each payload is signed with HMAC-SHA256 in `X-Webhook-Signature` when `WEBHOOK_SECRET` is set. A failed webhook never fails the training; delivery status is recorded on the job.
- **Metrics.** The dataset has only 50 rows, so a single train/test split would be noisy. `cross_validation` pools out-of-fold predictions from k-fold (k ≤ 5); that's the honest estimate of accuracy on new data. `training` is the fit on all rows.
- **Coefficients** are reported two ways:
  - `per_unit`: dollars per +1 unit of each feature. Together with `intercept`, this reproduces the prediction exactly.
  - `standardized`: dollars per +1 standard deviation, comparable across features.

  The features are strongly correlated (bigger houses are newer and have bigger lots). A plain linear fit on this data spreads the size effect unpredictably: it gives square_footage a *negative* coefficient (−$103 per sqft) and lot_size a large positive one. The predictions are still accurate, but the coefficients aren't believable. That's why the default model is **Ridge (alpha=1)**: every coefficient has a sensible sign, and its cross-validated accuracy is slightly *better* (R² 0.9844 vs 0.9835). Set `BOOTSTRAP_MODEL_TYPE=linear` to compare.
- **Contribution breakdown.** Each model stores the per-feature `mean` and `scale` the scaler learned. A prediction then splits exactly into `standardized_intercept` (the average training price) plus, for each feature, `standardized[i] × (x_i − mean_i) / scale_i`. The portal uses this to show *why* a house is priced above or below average.
- **Single worker.** uvicorn runs with `--workers 1` because the active model lives in process memory. Scaling out would mean moving the active-model pointer to shared storage and having each worker watch it.

### Adding a feature later (no code changes)

The inputs are defined in [`ml-api/features.yaml`](ml-api/features.yaml). That one file drives CSV validation, the `/predict` request schema in Swagger, and each model's recorded feature list. To add, say, `garage_spaces`:

```yaml
  - name: garage_spaces
    type: int
    min: 0
    max: 10
    required: false   # older CSVs without the column are still accepted
    example: 1
```

Then:
1. Restart the API.
2. Upload a CSV that includes the new column and train a model on it.
3. Promote that model with `PUT /models/active`.

Each model remembers its own features, so older models keep working without the field. A model trained with the field returns 422 if a request leaves it out. Once every training file has the column, switch it to `required: true`. This flow is covered by `test_new_optional_feature_can_be_added`.

### Configuration

| Env var | Default | |
|---|---|---|
| `DATA_DIR` | `/data` (Docker) | models, uploads and the job database |
| `FEATURES_PATH` | `features.yaml` | feature schema |
| `BOOTSTRAP_DATA_PATH` | bundled dataset | set it to an empty string to start without a model |
| `BOOTSTRAP_MODEL_TYPE` / `BOOTSTRAP_ALPHA` | `ridge` / `1.0` | model trained on first start |
| `MAX_UPLOAD_BYTES` | 5 MB | |
| `MIN_TRAINING_ROWS` | 10 | |
| `MAX_BATCH_SIZE` | 1000 | |
| `TRAINING_WORKERS` | 2 | |
| `WEBHOOK_SECRET` | unset | enables HMAC signatures |
| `WEBHOOK_MAX_ATTEMPTS` / `WEBHOOK_TIMEOUT_SECONDS` / `WEBHOOK_BACKOFF_SECONDS` | 3 / 5 / 1 | |

### CI/CD

On every push or PR that touches `ml-api/` or `data/`, [`.github/workflows/ml-api.yml`](.github/workflows/ml-api.yml) runs:
1. ruff (lint and format checks) and pytest on Python 3.12.
2. A Docker build, then a smoke test against the running container: health, predict, and a training upload.
3. On `main` only: a multi-arch (amd64 + arm64) image pushed to `ghcr.io/jackandjac/housing-prediction-ml-api`, tagged `latest` and with the short commit SHA.
