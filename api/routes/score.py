from typing import Any
from fastapi import APIRouter, Depends, HTTPException
try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = Any  # type: ignore[misc,assignment]
import time
from datetime import datetime, timezone

from ..schemas import ScoreRequest, ScoreResponse
from ..db.session import get_db
from ..db.models import AlertModel
from ..services import telemetry
from ..services.scorer import ModelsNotFound, get_scorer
from .alerts import alert_to_dict
from .ws import manager

# An attack burst is one incident, not thousands of rows: a flow joins the open
# alert of its family when that alert last grew less than GROUP_WINDOW_S ago.
GROUP_WINDOW_S = 60.0
# a growing alert is re-sent to the dashboard at most this often
BROADCAST_EVERY_S = 5.0
# model inputs kept per alert for scripts/retrain.py; an analyst's label on the
# alert applies to each of them
MAX_GROUP_SAMPLES = 100
# what the alert says about the traffic; an alert shows its most severe flow
_EVIDENCE = ("flow", "prediction", "anomaly_score", "is_novel", "severity",
             "explanation", "mitre", "recommended_action")

_RECENT_ALERTS = {}  # family -> {"id", "last_seen", "last_broadcast"}

router = APIRouter()


def scorer_dependency():
    try:
        return get_scorer()
    except ModelsNotFound as e:
        raise HTTPException(status_code=503, detail=str(e))


def _open_group(db, family, ts_float):
    """The alert this family's flow should join, or None to open a new one."""
    recent = _RECENT_ALERTS.get(family)
    if not recent or ts_float - recent["last_seen"] >= GROUP_WINDOW_S:
        return None
    row = db.query(AlertModel).filter(AlertModel.id == recent["id"]).first()
    # Only an alert nobody has acted on keeps growing. Once it is acknowledged,
    # dismissed or resolved, more flows are traffic the analyst has not seen:
    # folding them in hid a live attack inside a dismissed false positive.
    # A row that is gone (the database was reset) starts over too.
    if row is None or row.status != "open":
        return None
    return row


def _join(row, alert_data, feats):
    """Fold one flow into an open alert. True when it raised the alert's severity."""
    row.flow_count = (row.flow_count or 1) + 1
    # a Low first flow must not hide a Critical one that joins it
    escalated = alert_data["severity"]["score"] > (row.severity or {}).get("score", -1)
    if escalated:
        for field in _EVIDENCE:
            setattr(row, field, alert_data[field])
    # alerts stored before grouping kept one flow's inputs as a dict
    samples = row.features if isinstance(row.features, list) else ([row.features] if row.features else [])
    if feats is not None and len(samples) < MAX_GROUP_SAMPLES:
        # a new list: a JSON column is only saved when it is reassigned
        row.features = samples + [feats]
    return escalated


@router.post("/score", response_model=ScoreResponse)
async def score_flows(req: ScoreRequest, db: Session = Depends(get_db),
                      scorer=Depends(scorer_dependency)):
    started = time.perf_counter()
    alerts = scorer.score([f.features for f in req.flows], [f.meta for f in req.flows])
    # model inputs are stored for retraining, not sent to analysts
    features = [a.pop("features", None) for a in alerts]

    touched = {}  # alert id -> row, for alerts opened or re-sent by this request

    for alert_data, feats in zip(alerts, features):
        family = alert_data["prediction"]["family"]
        aware = datetime.fromisoformat(alert_data["timestamp"].replace("Z", "+00:00"))
        ts_float = aware.timestamp()
        # stored naive UTC, as SQLite returns it, so every alert prints as "...Z"
        ts = aware.astimezone(timezone.utc).replace(tzinfo=None)

        row = _open_group(db, family, ts_float)
        if row is not None:
            escalated = _join(row, alert_data, feats)
            row.timestamp = ts
            recent = _RECENT_ALERTS[family]
            recent["last_seen"] = ts_float
            # a rise in severity is news; a growing count can wait
            if row.id not in touched and (escalated or ts_float - recent["last_broadcast"] >= BROADCAST_EVERY_S):
                recent["last_broadcast"] = ts_float
                touched[row.id] = row
            continue

        row = AlertModel(
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
            features=[feats] if feats is not None else None,
        )
        db.add(row)
        # the session does not autoflush: without this, the rest of this family
        # in the same request could not find the new row and were not counted
        db.flush()
        _RECENT_ALERTS[family] = {"id": row.id, "last_seen": ts_float, "last_broadcast": ts_float}
        touched[row.id] = row
        telemetry.ALERTS_OPENED.labels(family).inc()

    db.commit()
    # Sent as stored, not as the flow that just arrived: a re-send built from the
    # new flow carried status "open" and wiped the analyst's note on screen.
    returned = [alert_to_dict(row) for row in touched.values()]
    for alert in returned:
        await manager.broadcast(alert)
    telemetry.FLOWS_SCORED.inc(len(req.flows))
    telemetry.FLOWS_ALERTED.inc(len(alerts))
    telemetry.SCORE_SECONDS.observe(time.perf_counter() - started)
    return {"scored": len(req.flows), "alerted": len(alerts), "alerts": returned}
