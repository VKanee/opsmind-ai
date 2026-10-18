from __future__ import annotations

import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import text

from app.api.router import api_router
from app.config import Settings, get_settings
from app.db import Database
from app.seed import ensure_seed_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("opsmind.api")

REQUEST_COUNT = Counter(
    "opsmind_http_requests_total",
    "HTTP request count",
    ["method", "path", "status"],
)
REQUEST_LATENCY = Histogram(
    "opsmind_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "path"],
)


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if app_settings.database_url.startswith("sqlite"):
            database_path = app_settings.database_url.removeprefix("sqlite:///")
            if database_path.startswith("./"):
                database_path = database_path[2:]
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        database = Database(app_settings.database_url)
        database.create_schema()
        app.state.settings = app_settings
        app.state.db = database
        if app_settings.seed_demo_data:
            with database.session_factory() as session:
                ensure_seed_data(session, app_settings)
        logger.info("OpsMind API started in %s mode", app_settings.environment)
        try:
            yield
        finally:
            database.close()

    app = FastAPI(
        title="OpsMind AI API",
        version="0.1.0",
        description=(
            "Enterprise incident intelligence API with evidence-backed investigations, "
            "human approval controls, RBAC, and append-only audit events."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        started = time.perf_counter()
        response: Response = await call_next(request)
        route = request.scope.get("route")
        path = getattr(route, "path", request.url.path)
        duration = time.perf_counter() - started
        REQUEST_COUNT.labels(request.method, path, str(response.status_code)).inc()
        REQUEST_LATENCY.labels(request.method, path).observe(duration)
        response.headers["x-request-id"] = request_id
        response.headers["x-process-time"] = f"{duration:.4f}"
        return response

    @app.get("/health/live", tags=["health"])
    def health_live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    def health_ready(request: Request) -> dict[str, str]:
        with request.app.state.db.session_factory() as session:
            session.execute(text("SELECT 1"))
        return {"status": "ready"}

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    app.include_router(api_router)
    return app


app = create_app()
