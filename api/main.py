from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db.session import engine, Base
from .routes import score, alerts, metrics, ws

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NetWatch API", version="1.0.0")

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
