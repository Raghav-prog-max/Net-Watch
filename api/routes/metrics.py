import json
import os
from collections import Counter
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.models import AlertModel
from ..db.session import get_db
from ..services.scorer import MODEL_DIR, ROOT
from .score import scorer_dependency

router = APIRouter()

REPORT_PATH = Path(os.environ.get("NETWATCH_REPORT", ROOT / "reports" / "metrics.json"))
CONFIG_PATH = ROOT / "ml" / "config.yaml"
MODEL_CARD_PATH = ROOT / "docs" / "model_card.md"
TRIAGE_STATUSES = ("open", "acknowledged", "escalated", "false_positive", "resolved")


def _config():
    return yaml.safe_load(open(CONFIG_PATH)) if CONFIG_PATH.exists() else {}


def _synthetic_data() -> bool:
    """Same test as ml/evaluate/model_card.py: were the models trained on the
    output of scripts/make_synthetic.py rather than CICIDS2017?"""
    raw = ROOT / _config().get("paths", {}).get("raw_dir", "data/raw")
    return raw.exists() and any(p.name.lower().startswith("synthetic") for p in raw.iterdir())


@router.get("/metrics/model")
def get_model_metrics():
    """The evaluation report written by `make train`, unchanged, plus where the
    numbers came from. Nothing here is estimated or filled in."""
    if not REPORT_PATH.exists():
        raise HTTPException(status_code=503, detail=f"{REPORT_PATH} not found; run `make train` first")
    report = json.load(open(REPORT_PATH))
    report["synthetic_data"] = _synthetic_data()
    return report


@router.get("/metrics/drift")
def get_drift(scorer=Depends(scorer_dependency)):
    """PSI of recent benign-looking traffic against the training reference."""
    drift = _config().get("drift", {})
    out = scorer.drift()
    out["bands"] = {"warning": drift.get("warn_psi", 0.10), "drift": drift.get("drift_psi", 0.25)}
    return out


@router.get("/models")
def get_models(db: Session = Depends(get_db)):
    active = Path(MODEL_DIR)
    thresholds_path = active / "thresholds.json"
    if not thresholds_path.exists():
        raise HTTPException(status_code=503, detail=f"no trained models in {active}; run `make train` first")
    t = json.load(open(thresholds_path))
    drift = _config().get("drift", {})

    classifier = "unknown"
    if REPORT_PATH.exists():
        classifier = json.load(open(REPORT_PATH)).get("classifier", classifier)

    counts = Counter(status for (status,) in db.query(AlertModel.status).all())
    return {
        "active": active.name,
        "versions": sorted(p.name for p in active.parent.iterdir()
                           if (p / "classifier.joblib").exists()),
        "classifier": f"{classifier} + Isolation Forest + family novelty check",
        "thresholds": {
            "attack_threshold": round(t["attack_threshold"], 4),
            "anomaly_threshold": round(t["anomaly_threshold"], 4),
            "fpr_budget": t["fpr_budget"],
            "drift_psi_warning": drift.get("warn_psi", 0.10),
            "drift_psi_drift": drift.get("drift_psi", 0.25),
        },
        "feedback": {s: counts.get(s, 0) for s in TRIAGE_STATUSES},
        "model_card": MODEL_CARD_PATH.read_text(encoding="utf-8") if MODEL_CARD_PATH.exists() else None,
    }
