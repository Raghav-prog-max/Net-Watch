import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db.session import engine, Base, ensure_schema
from .routes import score, alerts, metrics, ws
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
    yield


app = FastAPI(title="NetWatch API", version="1.0.0", lifespan=lifespan)

# Allow all CORS for demo purposes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
