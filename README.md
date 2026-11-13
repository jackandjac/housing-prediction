# Housing Price Prediction

Monorepo for the full-stack interview tasks.

| Path | What | Status |
|---|---|---|
| [`ml-api/`](ml-api/) | **Task 1**: FastAPI + scikit-learn regression API with async training (job history in MongoDB), a model registry and webhooks | ✅ |
| [`portal/`](portal/) | **Task 2**: Next.js 16 portal hosting both apps | ✅ |
| [`estimator-api/`](estimator-api/) | **Task 2, App 1** backend: FastAPI + MongoDB | ✅ |
| [`market-api/`](market-api/) | **Task 2, App 2** backend: Java 21 + Spring Boot 3.4.4 | ✅ |
| [`data/`](data/) | `House_Price_Dataset.csv` (training data) and `Test_Data_For_Prediction.csv` (unlabelled rows to predict) | |

---

## Task 1: ML API

### Run it

Training job history is stored in MongoDB, so the container needs `MONGODB_URI`. Use the Atlas cluster through `scripts/with-secrets.sh`, or a throwaway local MongoDB:

```bash
docker run -d --name mongo -p 27017:27017 mongo:7.0      # throwaway MongoDB (skip if using Atlas)

# Pre-built image from GitHub Actions (amd64 + arm64)
docker run --rm -p 8000:8000 -v ml-data:/data -e MONGODB_URI=mongodb://host.docker.internal:27017 \
  ghcr.io/jackandjac/housing-prediction-ml-api:latest

# or build locally (from the repo root)
docker build -f ml-api/Dockerfile -t housing-ml-api .
docker run --rm -p 8000:8000 -v ml-data:/data -e MONGODB_URI=mongodb://host.docker.internal:27017 housing-ml-api
```

Open **http://localhost:8000/docs** for Swagger UI.

On first start, the API trains a Ridge model (alpha=1) from the bundled `House_Price_Dataset.csv` and makes it active, so `/predict` works straight away. Models and uploads are kept in the `/data` volume and training job history in MongoDB, so both survive restarts.

#### Live demo in GitHub Codespaces

The Codespace runs the whole stack (all four services). See [Live demo](#live-demo-in-github-codespaces-1) under Task 2.

<details>
<summary>Without Docker</summary>

```bash
cd ml-api
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export MONGODB_URI=mongodb://localhost:27017       # or: ../scripts/with-secrets.sh <command>
uvicorn app.main:create_app --factory --reload
pytest                                                # each test uses its own collection and drops it
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
- **Job history in MongoDB, model files on disk.** Training jobs are documents keyed by their id in `housing.trainings`, indexed for newest-first listing with or without a status filter. Model files (`model.joblib`, `metadata.json`) and the active-model pointer stay in `DATA_DIR`: they are binary artifacts read on every restart, and predictions keep working from them while MongoDB is down. In that case `/health` reports `degraded` / `database: unreachable` and the `/trainings` endpoints return 503 until it recovers. On startup, jobs still `submitted` or `running` from a previous process are marked `failed` ("interrupted by service restart"), which is why each ml-api instance needs its own collection (`MONGODB_TRAININGS_COLLECTION`). Job records also refer to model files that exist only in that instance's `DATA_DIR`.
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
| `MONGODB_URI` | **required** | training job history; credentials are redacted from logs and errors |
| `MONGODB_DB` / `MONGODB_TRAININGS_COLLECTION` | `housing` / `trainings` | one collection per ml-api instance; `scripts/start-all.sh` defaults to `trainings` in a Codespace and `trainings_local` elsewhere |
| `MONGODB_TIMEOUT_MS` | 5000 | server selection timeout |
| `DATA_DIR` | `/data` (Docker) | model files, uploads and the active-model pointer |
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
1. ruff (lint and format checks) and pytest on Python 3.12, against a `mongo:7.0` service container.
2. A Docker build, then a smoke test against the running container: health, predict, and a training upload.
3. On `main` only: a multi-arch (amd64 + arm64) image pushed to `ghcr.io/jackandjac/housing-prediction-ml-api`, tagged `latest` and with the short commit SHA.

---

## Task 2: Multi-application portal

```
Browser ──► portal (Next.js :3000)
              │  server components + route handlers call the backends server-side;
              │  the browser never talks to a backend directly (no CORS, backend URLs stay private)
              ├──► estimator-api (FastAPI :8001) ──► MongoDB Atlas (estimates)
              │          └──────────────┐
              ├──► market-api (Spring Boot :8080)
              │          └──────────────┴──► ml-api (Task 1, :8000) ──► MongoDB Atlas (trainings)
              └──► ml-api directly, for Model Studio ────────▲
```

### Run everything

```bash
# Mac (MONGODB_URI comes from the Keychain, see scripts/with-secrets.sh)
scripts/start-all.sh                 # builds what's missing, starts all four services, waits until healthy
scripts/start-all.sh stop

# or with Docker
scripts/with-secrets.sh docker compose up --build
```

Open http://localhost:3000. Swagger: ml-api `:8000/docs`, estimator-api `:8001/docs`, market-api `:8080/swagger-ui.html`.

#### Live demo in GitHub Codespaces

1. Add `MONGODB_URI` as a Codespaces secret for this repository (Settings → Secrets and variables → Codespaces), and allow access from anywhere in MongoDB Atlas *Network Access* (Codespaces have no fixed IP).
2. **Code → Codespaces → Create codespace on main.** The first start takes about 5 minutes: it installs Python, Node and Java dependencies and builds the portal and the jar. After that, `scripts/start-all.sh` starts everything and the portal opens on port 3000.
3. Port 3000 is made public so interviewers can open it without a GitHub login. The backend ports stay private. If making it public fails, use **PORTS → right-click 3000 → Port Visibility → Public**.
4. Optional: add `MODEL_ADMIN_TOKEN` as a second Codespaces secret to choose Model Studio's admin token. Without it, `start-all.sh` generates one and prints it in the start-up log (also saved in `/tmp/housing-logs/model-admin-token`).

Notes:
- The devcontainer asks for a 4-core machine, which uses free Codespace hours twice as fast as 2 cores.
- Logs are in `/tmp/housing-logs/`. Restart with `scripts/start-all.sh stop && scripts/start-all.sh`. After pulling new portal code, use `REBUILD=1 scripts/start-all.sh`.

### App 1: Property Value Estimator (`/estimator`, Python backend)

| Requirement | Where |
|---|---|
| Form with every model field | The form is **generated from ml-api `GET /features`** (through `estimator-api /form-schema`), so a field added to `features.yaml` appears automatically. `components/estimator/EstimateForm.tsx` |
| Client-side validation | zod rules built from the same schema the server validates against (`lib/estimate-schema.ts`, unit-tested); server field errors are mapped back onto the inputs |
| Results as a table and a chart | Inputs vs market average with each feature's dollar effect, plus a contribution bar chart. The baseline plus the contributions adds up exactly to the prediction. |
| History | Stored in MongoDB by estimator-api. First page rendered on the server, then paged with TanStack Query; optimistic delete |
| Comparison | Pick 2–4 estimates (selection kept in a zustand store, persisted in the browser) → `/estimator/compare?ids=…`: price chart plus a feature table with per-feature effects |
| Backend | `POST /estimates` validates against the live model schema, calls ml-api, stores the estimate and its breakdown. Errors are field-level 422s, 503s when ml-api or MongoDB is down, and `/health` reports `degraded` instead of crashing |

### App 2: Property Market Analysis (`/market`, Java backend)

| Requirement | Where |
|---|---|
| Interactive dashboard | KPI tiles, prices by segment (bedrooms, bathrooms, decade, school or distance band), price histogram, correlation with price, model-vs-actual scatter, and live cache statistics |
| Segment filters | Range filters on any column (`<column>.min/.max`) kept **in the URL**, so a filtered view can be shared or bookmarked; applied in a React transition |
| What-if tool | `/market/what-if`: vary one feature over a range; the Java service makes one batch call to ml-api. Results are cached per active model, and the UI shows "Served from cache" |
| CSV / PDF export | Generated by Java (commons-csv, OpenPDF) with the current filters and sort, streamed through the portal |
| Responsive sortable table | `/market/properties`: server-side sort and paging (`aria-sort`), sticky first column, horizontal scroll on phones |
| Backend | REST endpoints, aggregate statistics, ml-api integration, Caffeine caches with recorded statistics (`GET /api/market/cache-stats`). Model-dependent cache keys include the active model id. The active id is cached for 20 s and the feature list for 30 s, so results follow a model switch within about 30 s |

### App 3: Model Studio (`/models`, Python backend)

Manage the model that both apps use, without Swagger.

| Feature | Where |
|---|---|
| Train from an uploaded CSV | `/models/train`: pick linear or ridge (with alpha), upload, and follow the job live (queued → training → succeeded/failed, polled every second). ml-api validates the file first; its line-numbered problems are listed. The page shows the columns the file needs, from `GET /features` |
| Monitor models | `/models`: the active model's held-out (cross-validated) R², average and RMS error; every model with its accuracy; **Make active** on any of them |
| Model details | `/models/[id]`: held-out vs fitted metrics, standardized coefficient chart, per-unit effects with training averages, dataset hash and ignored columns |
| Job history | `/models/trainings`: status, file, rows, type, duration and result of every job; refreshes while jobs run |
| Service status | Health of ml-api, estimator-api and market-api, refreshed every 15 s (also on the home page) |

**Access.** Viewing is open. Training and switching models need an admin token, because the Codespace portal is public:
- The portal reads `MODEL_ADMIN_TOKEN` at request time. Without it, Model Studio is view-only and write requests get 403.
- The token is entered once per browser tab (kept in `sessionStorage`), sent in an `x-admin-token` header, and checked by the portal with a constant-time comparison. It is never forwarded to ml-api.
- `scripts/start-all.sh` uses `MODEL_ADMIN_TOKEN` if set, otherwise reuses or generates one and prints it. With Docker, pass it to compose: `MODEL_ADMIN_TOKEN=… docker compose up`.
- The `/api/ml/*` proxy only forwards the reads Model Studio needs plus `POST /trainings` and `PUT /models/active`; ids must be plain `[A-Za-z0-9_-]`. `callback_url` isn't offered, so the portal can't be used to make ml-api call arbitrary URLs.
- After a switch, estimator-api and market-api pick up the new model within about 30 seconds (they cache the active model briefly).

### Next.js implementation notes

- **Next.js 16 App Router** with Cache Components and Partial Prefetching (the `create-next-app` defaults). Every page is a static shell, and backend data streams in through `<Suspense>`, so `next build` needs no running backend. CI builds the portal with every backend unreachable.
- **Server components** do the initial data loading, with parallel `Promise.all` fetches on the dashboard. **Client components** handle forms, filters, charts and tables.
- **State:**
  - server state: TanStack Query;
  - shareable view state (filters, sort, page, grouping): the URL;
  - per-browser state (the comparison selection): zustand with persistence;
  - form state: react-hook-form with zod.
- **Custom hooks:** `useCreateEstimate`, `useEstimateHistory`, `useDeleteEstimate`, `useCompareSelection`, `useMarketFilters`, `useWhatIf`.
- **Backend-for-frontend:** `app/api/{estimator,market}/[...path]` forward only allow-listed paths, normalise errors and stream downloads. Both backends' error formats (FastAPI and Spring `ProblemDetail`) become one `ApiError` (`lib/errors.ts`).
- **Loading and errors:** `loading.tsx`, `error.tsx` (with `retry`) and `not-found.tsx` at the root and in each app, plus `global-error.tsx`. A failing panel, such as model fit when ml-api is down, shows an inline message instead of breaking the page.
- **Design system:** one token set in `app/globals.css`, with light and dark themes. Each app gets its own accent through `data-app`, on shared components in `components/ui`.
- **Accessibility:**
  - labelled inputs, with errors linked through `aria-describedby`;
  - `aria-current` navigation and `aria-sort` table headers;
  - a skip link and visible focus rings;
  - charts with text summaries;
  - motion that respects `prefers-reduced-motion`.
- **Transitions:** pages fade in via `template.tsx`, and filter changes keep the current view visible while new data loads.

### Tests and CI

| Service | Tests | CI (`.github/workflows/`) |
|---|---|---|
| ml-api | pytest (39) against a real MongoDB (a service container in CI, a throwaway collection per test locally) | lint, test, container smoke test, multi-arch image |
| estimator-api | pytest against a real MongoDB (a service container in CI, a throwaway collection locally), ml-api faked with `httpx.MockTransport` | same |
| market-api | JUnit 5 + MockMvc + `MockRestServiceServer` (expected statistics checked against pandas) | `mvn verify`, container smoke test, image |
| portal | ESLint, TypeScript, vitest (form schema and URL filters), production build with no backends | same, plus a container smoke test |

