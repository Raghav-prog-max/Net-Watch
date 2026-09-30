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

_RECENT_ALERTS = {}  # family -> (timestamp_float, alert_id)

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
    # model inputs are stored for retraining, not sent to analysts
    features = [a.pop("features", None) for a in alerts]
    
    returned_alerts = []
    
    for alert_data, feats in zip(alerts, features):
        family = alert_data["prediction"]["family"]
        ts = datetime.fromisoformat(alert_data["timestamp"].replace("Z", "+00:00"))
        ts_float = ts.timestamp()
        
        recent = _RECENT_ALERTS.get(family)
        if recent and (ts_float - recent["last_seen"]) < 60.0:
            alert_id = recent["id"]
            db_alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
            if db_alert:
                if getattr(db_alert, 'flow_count', None) is not None:
                    db_alert.flow_count += 1
                else:
                    db_alert.flow_count = 2
                db_alert.timestamp = ts
                
                recent["last_seen"] = ts_float
                
                if (ts_float - recent.get("last_broadcast", 0)) >= 5.0:
                    recent["last_broadcast"] = ts_float
                    update_data = dict(alert_data)
                    update_data["id"] = alert_id
                    update_data["flow_count"] = db_alert.flow_count
                    update_data["timestamp"] = ts.isoformat() + "Z"
                    returned_alerts.append(update_data)
            continue

        _RECENT_ALERTS[family] = {"last_seen": ts_float, "id": alert_data["id"], "last_broadcast": ts_float}
        alert_data["flow_count"] = 1
        db.add(AlertModel(
            id=alert_data["id"],
            timestamp=ts,
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
            model_version=alert_data["model_version"],
            flow_count=1,
            features=feats,
        ))
        returned_alerts.append(alert_data)
        
    db.commit()
    for alert_data in returned_alerts:
        await manager.broadcast(alert_data)
    return {"scored": len(req.flows), "alerts": returned_alerts}
