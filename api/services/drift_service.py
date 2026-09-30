"""api/services/drift_service.py

The drift report behind GET /metrics/drift (handbook: drift monitoring).
It joins two sources:
  - api/services/scorer.py : the live window of recent flows (PSI, KS, alert
                             rate, family mix, history), rules in ml/drift/monitor.py
  - the alert store        : the share of recent alerts analysts marked as
                             false positives
"""
from typing import Any, Dict

from ..db.models import AlertModel
from ..db.session import SQLALCHEMY_AVAILABLE
from .scorer import drift_config


def false_positive_share(db, last_n: int) -> Dict[str, Any]:
    """Share of the most recent `last_n` alerts that analysts marked false_positive.

    Reported, not part of the status rule: the handbook tracks it as a signal that
    normal traffic has moved away from what the models learned. Untriaged alerts
    count in the denominator, so it reads low while the queue is new.
    """
    rows = []
    if db is not None:
        q = db.query(AlertModel).order_by(AlertModel.timestamp.desc())
        # the no-SQLAlchemy fallback store has no LIMIT
        rows = q.limit(last_n).all() if SQLALCHEMY_AVAILABLE else q.all()[:last_n]
    fps = sum(1 for r in rows if r.status == "false_positive")
    return {"share": round(fps / len(rows), 4) if rows else None,
            "false_positives": fps, "alerts": len(rows)}


def compute_drift(scorer, db=None) -> Dict[str, Any]:
    """The current drift report: status, PSI/KS, alert rates, family mix, history,
    the analyst false-positive share, and the PSI bands used."""
    c = getattr(scorer, "drift_cfg", None) or drift_config()
    out = scorer.drift()
    out["fp_share"] = false_positive_share(db, int(c.get("fp_share_alerts", 500)))
    out["bands"] = {"warning": c["warn_psi"], "drift": c["drift_psi"]}
    return out
