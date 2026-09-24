from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..schemas import Alert, Feedback
from ..db.session import get_db
from ..db.models import AlertModel

router = APIRouter()

@router.get("/alerts", response_model=dict)
def get_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    family: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(AlertModel)

    if status:
        query = query.filter(AlertModel.status == status)
    
    query = query.order_by(AlertModel.timestamp.desc())
    all_alerts = query.all()

    # In-memory filtering for JSON fields (since SQLite JSON syntax varies and we want this robust for MVP)
    if severity:
        all_alerts = [a for a in all_alerts if a.severity and a.severity.get("level") == severity]
        
    if family:
        all_alerts = [a for a in all_alerts if a.prediction and a.prediction.get("family") == family]

    total = len(all_alerts)
    alerts = all_alerts[(page - 1) * size : page * size]

    # Convert DB models back to dict for Pydantic
    alert_list = []
    for a in alerts:
        alert_dict = {
            "id": a.id,
            "timestamp": a.timestamp.isoformat() + "Z",
            "flow": a.flow,
            "prediction": a.prediction,
            "anomaly_score": a.anomaly_score,
            "is_novel": a.is_novel,
            "severity": a.severity,
            "explanation": a.explanation,
            "mitre": a.mitre,
            "recommended_action": a.recommended_action,
            "status": a.status,
            "analyst_label": a.analyst_label,
            "analyst_note": a.analyst_note,
            "model_version": a.model_version
        }
        alert_list.append(alert_dict)

    return {
        "items": alert_list,
        "total": total,
        "page": page,
        "size": size
    }

@router.get("/alerts/{id}", response_model=Alert)
def get_alert(id: str, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {
        "id": alert.id,
        "timestamp": alert.timestamp.isoformat() + "Z",
        "flow": alert.flow,
        "prediction": alert.prediction,
        "anomaly_score": alert.anomaly_score,
        "is_novel": alert.is_novel,
        "severity": alert.severity,
        "explanation": alert.explanation,
        "mitre": alert.mitre,
        "recommended_action": alert.recommended_action,
        "status": alert.status,
        "analyst_label": alert.analyst_label,
        "analyst_note": alert.analyst_note,
        "model_version": alert.model_version
    }

@router.patch("/alerts/{id}", response_model=Alert)
def update_alert(id: str, feedback: Feedback, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if feedback.status is not None:
        alert.status = feedback.status
    if feedback.analyst_label is not None:
        alert.analyst_label = feedback.analyst_label
    if feedback.analyst_note is not None:
        alert.analyst_note = feedback.analyst_note
        
    db.commit()
    db.refresh(alert)
    
    return {
        "id": alert.id,
        "timestamp": alert.timestamp.isoformat() + "Z",
        "flow": alert.flow,
        "prediction": alert.prediction,
        "anomaly_score": alert.anomaly_score,
        "is_novel": alert.is_novel,
        "severity": alert.severity,
        "explanation": alert.explanation,
        "mitre": alert.mitre,
        "recommended_action": alert.recommended_action,
        "status": alert.status,
        "analyst_label": alert.analyst_label,
        "analyst_note": alert.analyst_note,
        "model_version": alert.model_version
    }
