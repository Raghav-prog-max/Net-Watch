from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..schemas import FlowData, Alert
from ..db.session import get_db
from ..db.models import AlertModel
from ..services.scorer import score_flow
from .ws import manager

router = APIRouter()

@router.post("/score", response_model=List[Alert])
async def score_flows(flows: List[FlowData], db: Session = Depends(get_db)):
    alerts = []
    for flow in flows:
        alert_data = score_flow(flow)
        if alert_data:
            # Create DB model
            db_alert = AlertModel(
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
            )
            db.add(db_alert)
            alerts.append(alert_data)
            
            # Broadcast to websocket
            await manager.broadcast(alert_data)

    db.commit()
    return alerts
