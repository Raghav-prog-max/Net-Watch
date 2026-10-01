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
    created = {}  # alert id -> its entry in returned_alerts, for groups opened in this request

    for alert_data, feats in zip(alerts, features):
        family = alert_data["prediction"]["family"]
        ts = datetime.fromisoformat(alert_data["timestamp"].replace("Z", "+00:00"))
        ts_float = ts.timestamp()

        recent = _RECENT_ALERTS.get(family)
        db_alert = None
        if recent and (ts_float - recent["last_seen"]) < 60.0:
            db_alert = db.query(AlertModel).filter(AlertModel.id == recent["id"]).first()
        # a group whose row is gone (e.g. the database was reset) starts a new one
        # below rather than dropping the flow
        if db_alert is not None:
            alert_id = recent["id"]
            if getattr(db_alert, 'flow_count', None) is not None:
                db_alert.flow_count += 1
            else:
                db_alert.flow_count = 2
            db_alert.timestamp = ts

            recent["last_seen"] = ts_float

            if alert_id in created:
                # opened earlier in this request: it is already being returned
                created[alert_id]["flow_count"] = db_alert.flow_count
            elif (ts_float - recent.get("last_broadcast", 0)) >= 5.0:
                recent["last_broadcast"] = ts_float
                update_data = dict(alert_data)
                update_data["id"] = alert_id
                update_data["flow_count"] = db_alert.flow_count
                # ts is timezone-aware: appending "Z" gave "...+00:00Z",
                # which the response model rejects (500 on every replay)
                update_data["timestamp"] = ts.isoformat().replace("+00:00", "Z")
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
        # the session does not autoflush: without this, the rest of this family
        # in the same request could not find the new row and were not counted
        db.flush()
        returned_alerts.append(alert_data)
        created[alert_data["id"]] = alert_data
        
    db.commit()
    for alert_data in returned_alerts:
        await manager.broadcast(alert_data)
    return {"scored": len(req.flows), "alerts": returned_alerts}
