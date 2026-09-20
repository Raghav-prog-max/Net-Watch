"""NetWatch API.

    uvicorn api.main:app --reload

Nothing in this service blocks, drops or rate-limits traffic. It writes alerts
and streams them to analysts. That is the whole contract.
"""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api import db
from api.schemas import ScoreRequest, Triage
from api.scorer import Scorer

app = FastAPI(title="NetWatch", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])

scorer = Scorer()
conn = db.connect()
clients: list[WebSocket] = []


async def broadcast(alert: dict):
    dead = []
    for ws in clients:
        try:
            await ws.send_json(alert)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.remove(ws)


@app.post("/score")
async def score(req: ScoreRequest):
    alerts = scorer.score([f.features for f in req.flows], [f.meta for f in req.flows])
    for a in alerts:
        db.insert(conn, a)
        await broadcast(a)
    return {"scored": len(req.flows), "alerts": alerts}


@app.get("/alerts")
def list_alerts(severity: str = None, status: str = None, family: str = None,
                limit: int = 100, offset: int = 0):
    return {"alerts": db.query(conn, severity, status, family, limit, offset)}


@app.get("/alerts/{alert_id}")
def get_alert(alert_id: str):
    alert = db.get(conn, alert_id)
    if not alert:
        raise HTTPException(404, "alert not found")
    return alert


@app.patch("/alerts/{alert_id}")
def triage_alert(alert_id: str, body: Triage):
    alert = db.triage(conn, alert_id, body.status, body.analyst_label, body.analyst_note)
    if not alert:
        raise HTTPException(404, "alert not found")
    return alert


@app.get("/metrics/model")
def model_metrics():
    path = Path("reports/metrics.json")
    if not path.exists():
        raise HTTPException(404, "run `make train` first")
    return json.load(open(path))


@app.get("/metrics/drift")
def drift():
    return scorer.drift()


@app.get("/models")
def models():
    return {"active": scorer.version, "classifier": scorer.kind,
            "thresholds": scorer.thresholds,
            "feedback": db.feedback_counts(conn)}


@app.websocket("/ws/alerts")
async def ws_alerts(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in clients:
            clients.remove(ws)
