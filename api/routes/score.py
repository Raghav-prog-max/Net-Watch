from typing import Any
from fastapi import APIRouter, Depends, HTTPException
try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = Any  # type: ignore[misc,assignment]
from datetime import datetime

from ..schemas import ScoreRequest, ScoreResponse
from ..db.session import get_db
from ..db.models import AlertModel
from ..services.scorer import ModelsNotFound, get_scorer
from .ws import manager

router = APIRouter()


def scorer_dependency():
    try:
        return get_scorer()
    except ModelsNotFound as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/score", response_model=ScoreResponse)
async def score_flows(req: ScoreRequest, db: Session = Depends(get_db),
                      scorer=Depends(scorer_dependency)):
    alerts = scorer.score([f.features for f in req.flows], [f.meta for f in req.flows])
    for alert_data in alerts:
        db.add(AlertModel(
            id=alert_data["id"],
            timestamp=datetime.fromisoformat(alert_data["timestamp"].replace("Z", "+00:00")),
            flow=alert_data["flow"],
            prediction=alert_data["prediction"],
            anomaly_score=alert_data["anomaly_score"],
            is_novel=alert_data["is_novel"],
            severity=alert_data["severity"],
            explanation=alert_data["explanation"],
            mitre=alert_data["mitre"],
            recommended_action=alert_data["recommended_action"],
            status=alert_data["status"],
            analyst_label=alert_data["analyst_label"],
            analyst_note=alert_data["analyst_note"],
            model_version=alert_data["model_version"]
        ))
    db.commit()
    for alert_data in alerts:
        await manager.broadcast(alert_data)
    return {"scored": len(req.flows), "alerts": alerts}
