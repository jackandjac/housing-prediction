"""Property Value Estimator backend (App 1).

Run with:  uvicorn app.main:create_app --factory --port 8001
"""

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse

from .config import Settings
from .estimation import breakdown, validate_inputs
from .ml_client import MlApiRejectedError, MlApiUnavailableError, MlClient
from .repository import DatabaseUnavailableError, EstimateRepository
from .schemas import (
    Comparison,
    ErrorResponse,
    Estimate,
    EstimatePage,
    EstimateRequest,
    FormSchema,
    Health,
)

log = logging.getLogger("estimator_api")

# Display metadata for known fields. Unknown (newly added) fields still work with a derived label.
FIELD_DISPLAY: dict[str, tuple[str, str | None, float]] = {
    "square_footage": ("Living area", "sq ft", 1),
    "bedrooms": ("Bedrooms", None, 1),
    "bathrooms": ("Bathrooms", None, 0.5),
    "year_built": ("Year built", None, 1),
    "lot_size": ("Lot size", "sq ft", 1),
    "distance_to_city_center": ("Distance to city center", "miles", 0.1),
    "school_rating": ("School rating", "0–10", 0.1),
}

ERRORS = {
    422: {"model": ErrorResponse, "description": "Invalid input; `errors` lists each field"},
    503: {"model": ErrorResponse, "description": "Prediction service or database unavailable"},
}


def _field_display(spec: dict[str, Any]) -> dict[str, Any]:
    label, unit, step = FIELD_DISPLAY.get(
        spec["name"], (spec["name"].replace("_", " ").capitalize(), None, 1 if spec["type"] == "int" else 0.1)
    )
    return {**spec, "label": label, "unit": unit, "step": step}


def _error(code: int, message: str, errors: list[dict[str, str]] | None = None) -> HTTPException:
    return HTTPException(code, {"message": message, "errors": errors or []})


def create_app(
    settings: Settings | None = None,
    *,
    http_client: httpx.AsyncClient | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI is not set")

    repo = EstimateRepository(settings.mongodb_uri, settings.mongodb_db, settings.mongodb_collection)
    http = http_client or httpx.AsyncClient(base_url=settings.ml_api_url, timeout=settings.ml_api_timeout_seconds)
    ml = MlClient(http, settings.features_ttl_seconds)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        try:
            await repo.init()
        except DatabaseUnavailableError as exc:
            # Start anyway: /health reports degraded and history calls return 503 until it recovers.
            log.error("MongoDB unavailable at startup: %s", exc)
        yield
        await repo.close()
        if http_client is None:
            await http.aclose()

    app = FastAPI(
        title="Property Value Estimator API",
        version="1.0.0",
        description="Backend for the portal's estimator app: validates property details, gets a price "
        "from the ML API, explains it, and keeps a history of estimates in MongoDB.",
        lifespan=lifespan,
    )
    app.state.repo = repo

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_req: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path")), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": {"message": "invalid request", "errors": errors}})

    @app.exception_handler(MlApiUnavailableError)
    async def ml_unavailable_handler(_req: Request, exc: MlApiUnavailableError) -> JSONResponse:
        return JSONResponse(
            status_code=503, content={"detail": {"message": f"Estimates are unavailable: {exc}.", "errors": []}}
        )

    @app.exception_handler(DatabaseUnavailableError)
    async def db_unavailable_handler(_req: Request, exc: DatabaseUnavailableError) -> JSONResponse:
        log.error("database error: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "detail": {"message": "Estimate history is unavailable right now. Try again shortly.", "errors": []}
            },
        )

    # ---- form schema -------------------------------------------------------

    @app.get("/form-schema", response_model=FormSchema, tags=["estimates"], responses={503: ERRORS[503]})
    async def form_schema() -> dict[str, Any]:
        """Fields for the property form, from the active model. Labels, units and steps are display hints."""
        data = await ml.features()
        return {"model_id": data["model_id"], "fields": [_field_display(f) for f in data["features"]]}

    # ---- estimates ---------------------------------------------------------

    @app.post(
        "/estimates",
        response_model=Estimate,
        status_code=status.HTTP_201_CREATED,
        tags=["estimates"],
        responses=ERRORS,
    )
    async def create_estimate(body: EstimateRequest, response: Response) -> dict[str, Any]:
        """Validate the property details, predict its price, store it in history and return it with a breakdown."""
        fields = (await ml.features())["features"]
        clean, errors = validate_inputs(body.features, fields)
        if errors:
            raise _error(422, "Some property details are invalid.", errors)

        try:
            prediction = await ml.predict([clean])
        except MlApiRejectedError:
            # The active model changed between our schema check and the prediction.
            await ml.features(fresh=True)
            raise _error(422, "The model changed while you were editing. Reload the form and try again.") from None

        model_id = prediction["model_id"]
        info = await ml.model_info(model_id)
        doc = {
            "label": (body.label or "").strip() or None,
            "inputs": clean,
            "predicted_price": prediction["predictions"][0],
            "model_id": model_id,
            "model_type": info.get("model_type"),
            "breakdown": breakdown(clean, info),
            "created_at": datetime.now(UTC),
        }
        saved = await repo.insert(doc)
        response.headers["Location"] = f"/estimates/{saved['id']}"
        return saved

    @app.get("/estimates", response_model=EstimatePage, tags=["estimates"], responses={503: ERRORS[503]})
    async def list_estimates(
        limit: Annotated[int, Query(ge=1, le=settings.max_page_size)] = 20,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> dict[str, Any]:
        """Estimate history, newest first."""
        items, total = await repo.list(limit, offset)
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    @app.get(
        "/estimates/compare",
        response_model=Comparison,
        tags=["estimates"],
        responses={404: {"model": ErrorResponse}, **ERRORS},
    )
    async def compare_estimates(
        ids: Annotated[str, Query(description=f"Comma-separated estimate ids (2 to {settings.max_compare})")],
    ) -> dict[str, Any]:
        """Estimates side by side, in the order given."""
        wanted = list(dict.fromkeys(i.strip() for i in ids.split(",") if i.strip()))
        if not 2 <= len(wanted) <= settings.max_compare:
            raise _error(422, f"Choose between 2 and {settings.max_compare} different estimates to compare.")
        found = await repo.get_many(wanted)
        missing = [i for i, doc in zip(wanted, found, strict=True) if doc is None]
        if missing:
            raise _error(
                404, "Some estimates no longer exist.", [{"field": i, "message": "not found"} for i in missing]
            )
        items = [d for d in found if d is not None]
        feature_order: list[str] = []
        for item in items:
            feature_order += [f for f in item["inputs"] if f not in feature_order]
        by_price = sorted(items, key=lambda d: d["predicted_price"])
        return {
            "items": items,
            "features": feature_order,
            "cheapest_id": by_price[0]["id"],
            "most_expensive_id": by_price[-1]["id"],
        }

    @app.get("/estimates/{estimate_id}", response_model=Estimate, tags=["estimates"], responses={404: {}, 503: {}})
    async def get_estimate(estimate_id: str) -> dict[str, Any]:
        doc = await repo.get(estimate_id)
        if doc is None:
            raise _error(404, "Estimate not found.")
        return doc

    @app.delete("/estimates/{estimate_id}", status_code=204, tags=["estimates"], responses={404: {}, 503: {}})
    async def delete_estimate(estimate_id: str) -> Response:
        if not await repo.delete(estimate_id):
            raise _error(404, "Estimate not found.")
        return Response(status_code=204)

    # ---- ops ---------------------------------------------------------------

    @app.get("/health", response_model=Health, tags=["ops"])
    async def health() -> dict[str, Any]:
        """Always 200 while the process is up; `status` is `degraded` when a dependency is down."""
        db_ok = await repo.ping()
        try:
            ml_health = await ml.health()
            ml_state = "ok" if ml_health.get("model_loaded") else "no_model"
            active = ml_health.get("active_model_id")
        except MlApiUnavailableError:
            ml_state, active = "unreachable", None
        return {
            "status": "ok" if db_ok and ml_state == "ok" else "degraded",
            "database": "ok" if db_ok else "unreachable",
            "ml_api": ml_state,
            "active_model_id": active,
        }

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse("/docs")

    return app
