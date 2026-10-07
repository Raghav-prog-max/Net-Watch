import json
import logging
import os
import copy
from collections import Counter
from pathlib import Path

import yaml
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Response

from ml import registry

try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = Any  # type: ignore[misc,assignment]

from ..db.models import AlertModel
from ..db.session import get_db
from ..services import telemetry
from ..services.drift_service import compute_drift
from ..services.scorer import MODEL_DIR, ROOT, ModelsNotFound, get_scorer
from .score import scorer_dependency

log = logging.getLogger(__name__)
router = APIRouter()

# the report of the bundle being served, so the figures match the models
REPORT_PATH = Path(os.environ.get("NETWATCH_REPORT", registry.report_path(Path(MODEL_DIR).name)))
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
def get_drift(scorer=Depends(scorer_dependency), db: Session = Depends(get_db)):
    """Drift status now and over time: PSI and KS of recent benign-looking traffic
    against the training reference, alert rates, family mix, the analyst
    false-positive share (api/services/drift_service.py)."""
    return compute_drift(scorer, db)


def optional_scorer():
    """The scorer, or None before `make train`: /metrics still has counters and
    alert counts to report then."""
    try:
        return get_scorer()
    except ModelsNotFound:
        return None


@router.get("/metrics")
def prometheus_metrics(scorer=Depends(optional_scorer), db: Session = Depends(get_db)):
    """Prometheus text format (api/services/telemetry.py), scraped by
    deployment/monitoring/prometheus.yml. Prometheus scraped this path before it
    existed, so every target was down and the Grafana dashboard was empty."""
    counts = Counter(status for (status,) in db.query(AlertModel.status).all())
    state = {"alerts": {s: counts.get(s, 0) for s in TRIAGE_STATUSES},
             "model_version": Path(MODEL_DIR).name}
    if REPORT_PATH.exists():
        report = json.load(open(REPORT_PATH))
        system = report.get("system")
        state["report"] = {
            "false_alerts_per_10k": (system or report["main"])["false_alerts_per_10k_benign_flows"],
            "budget_per_10k": (system or {}).get("budget_per_10k"),
        }
    if scorer is not None:
        try:
            state["drift"] = compute_drift(scorer, db)
        except Exception:
            # a scrape still reports what it can; the failure shows on /metrics/drift
            log.exception("drift report failed during a /metrics scrape")
    return Response(telemetry.exposition(state), media_type=telemetry.CONTENT_TYPE)


VERSION_HISTORY_NOTE = (
    "These model versions are dynamically generated from the trained model bundles on disk. "
    "The active release's figures are read directly from its reports/metrics.json."
)


def _version_history(report):
    from pathlib import Path
    import json
    reports_dir = Path("reports")
    models_dir = Path("models")
    active_version = (models_dir / "ACTIVE").read_text().strip() if (models_dir / "ACTIVE").exists() else "v1"
    
    history = []
    
    # helper to find metrics.json files
    metrics_files = list(reports_dir.glob("**/metrics.json"))
    for p in metrics_files:
        if p.parent == reports_dir:
            version = "v1"
        else:
            version = p.parent.name
            
        try:
            r = json.load(open(p))
            sys_m = r.get("system", r.get("main", {}))
            history.append({
                "version": version,
                "title": f"Model Bundle {version}",
                "date": r.get("generated", "")[:10] if "generated" in r else "",
                "status": "active" if version == active_version else "superseded",
                "summary": f"System Macro-F1: {sys_m.get('macro_f1', 0):.3f} | False alerts/10k: {sys_m.get('false_alerts_per_10k_benign_flows', 0)}",
                "highlights": [
                    {"label": "Held-Out PortScan LOFO", "after": f"{100 * (next((x['caught_by_full_system'] for x in r.get('lofo', []) if x.get('family') == 'PortScan'), 0)):.1f}%" if r.get('lofo') else "—"},
                    {"label": "Unseen Attacks Alerted", "after": f"{100 * r.get('novel_families', {}).get('alerted', 0):.1f}%" if r.get('novel_families') else "—"},
                    {"label": "Unseen Shown as Unknown", "after": f"{100 * r.get('novel_families', {}).get('shown_as_unknown', 0):.1f}%" if r.get('novel_families') else "—"},
                ],
                "changelog": []
            })
        except Exception:
            pass

    # Basic sort: v2 > v1 > 1.2 > 1.1
    def sort_key(x):
        v = x["version"]
        if v.startswith("v"): return (1, v)
        return (0, v)
        
    history.sort(key=sort_key, reverse=True)
    return history


@router.get("/models")
def get_models(db: Session = Depends(get_db)):
    active = Path(MODEL_DIR)
    thresholds_path = active / "thresholds.json"
    if not thresholds_path.exists():
        raise HTTPException(status_code=503, detail=f"no trained models in {active}; run `make train` first")
    t = json.load(open(thresholds_path))
    drift = _config().get("drift", {})

    report = json.load(open(REPORT_PATH)) if REPORT_PATH.exists() else None
    classifier = (report or {}).get("classifier", "unknown")

    counts = Counter(status for (status,) in db.query(AlertModel.status).all())
    disk_versions = sorted(p.name for p in active.parent.iterdir()
                           if (p / "classifier.joblib").exists())
    return {
        "active": active.name,
        "versions": disk_versions,
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
        "version_history": _version_history(report),
        "version_history_note": VERSION_HISTORY_NOTE,
    }

