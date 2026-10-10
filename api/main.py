import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db.session import engine, Base, ensure_schema
from .routes import score, alerts, metrics, ws
from .services.auth import API_KEY_ENV, configured_key
from .services.scorer import ModelsNotFound, get_scorer

# Create database tables
Base.metadata.create_all(bind=engine)
ensure_schema()

log = logging.getLogger("netwatch")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the models and run SHAP once before taking traffic. Done lazily, the
    # first /score request took longer than the replayer's 10 s timeout.
    try:
        scorer = get_scorer()
        scorer.explainer.top_batch(scorer._matrix([{}]))
        log.info("models loaded from %s", scorer.version)
    except ModelsNotFound as e:
        log.warning("%s; /score, /metrics/drift and /models return 503 until then", e)
    if configured_key() is None:
        log.warning("%s is not set: POST /score and PATCH /alerts accept any caller", API_KEY_ENV)
    yield


app = FastAPI(title="NetWatch API", version="1.0.0", lifespan=lifespan)


def allowed_origins(value):
    """ALLOWED_ORIGINS: the comma-separated origins a dashboard on another origin
    is served from. Unset means any origin, which the local demo needs (dashboard
    on :3000, API on :8000); behind nginx both share one origin and CORS is not
    involved. deployment/.env.production.example set it, but nothing read it."""
    return [o.strip() for o in (value or "*").split(",") if o.strip()] or ["*"]


_origins = allowed_origins(os.environ.get("ALLOWED_ORIGINS"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # The dashboard sends no cookies. Credentials with "*" would let any site
    # call the API with a visitor's cookies, so only named origins get them.
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(score.router)
app.include_router(alerts.router)
app.include_router(metrics.router)
app.include_router(ws.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "NetWatch API is running"}
