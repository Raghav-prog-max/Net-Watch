from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, Dict, Optional
try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = Any  # type: ignore[misc,assignment]

from ..schemas import Alert, Feedback
from ..db.session import get_db, SQLALCHEMY_AVAILABLE
from ..db.models import AlertModel
from ..services.auth import require_api_key

router = APIRouter()


def alert_to_dict(a: AlertModel) -> Dict[str, Any]:
    """An alert as the API returns and broadcasts it. The stored model inputs
    (`features`) are for retraining only and are never sent."""
    return {
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
        "model_version": a.model_version,
        # flows folded into this alert (api/routes/score.py); NULL in a store
        # migrated from before grouping
        "flow_count": getattr(a, "flow_count", None) or 1,
    }


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

    if SQLALCHEMY_AVAILABLE:
        # filter, count and page in the database: loading every alert to keep one
        # page grew with the alert store
        if severity:
            query = query.filter(AlertModel.severity["level"].as_string() == severity)
        if family:
            query = query.filter(AlertModel.prediction["family"].as_string() == family)
        total = query.count()
        rows = (query.order_by(AlertModel.timestamp.desc())
                .offset((page - 1) * size).limit(size).all())
    else:
        # the no-SQLAlchemy fallback store cannot query JSON fields
        rows = query.order_by(AlertModel.timestamp.desc()).all()
        if severity:
            rows = [a for a in rows if a.severity and a.severity.get("level") == severity]
        if family:
            rows = [a for a in rows if a.prediction and a.prediction.get("family") == family]
        total = len(rows)
        rows = rows[(page - 1) * size: page * size]

    return {"items": [alert_to_dict(a) for a in rows], "total": total, "page": page, "size": size}


@router.get("/alerts/{id}", response_model=Alert)
def get_alert(id: str, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert_to_dict(alert)

@router.patch("/alerts/{id}", response_model=Alert, dependencies=[Depends(require_api_key)])
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
    return alert_to_dict(alert)
