import json
import logging
import os
from collections import Counter
from pathlib import Path

import yaml
from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from ml import registry

try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = Any  # type: ignore[misc,assignment]

from ..db.models import AlertModel
from ..db.session import get_db
from ..services.drift_service import compute_drift
from ..services.scorer import MODEL_DIR, ROOT
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


# A measured figure on the Models page: the rate with the flows it rests on, when
# the report has them (ml/evaluate/metrics.py support); "—" when the report has no
# such figure, never "0.0%".
def _figure(rate, support=None):
    if rate is None:
        return "—"
    flows = f" ({support['hits']:,} of {support['of']:,} flows)" if support else ""
    return f"{100 * rate:.1f}%{flows}"


def _lofo_row(r, family):
    return next((x for x in r.get("lofo", []) if x.get("family") == family), {})


VERSION_HISTORY_NOTE = (
    "These model versions are dynamically generated from the trained model bundles on disk. "
    "The active release's figures are read directly from its reports/metrics.json."
)


def _version_history():
    """One entry per trained bundle with a report (ml/registry.report_path); every
    figure is read from that bundle's metrics.json, none is typed in here."""
    active_version = registry.active_version()
    history = []
    for p in sorted(registry.REPORTS.glob("**/metrics.json")):
        version = "v1" if p.parent == registry.REPORTS else p.parent.name
        try:
            r = json.load(open(p, encoding="utf-8"))
        except (OSError, ValueError):
            log.warning("unreadable report %s left out of the version history", p)
            continue
        main = r.get("main", {})
        nf = r.get("novel_families", {})
        portscan = _lofo_row(r, "PortScan")
        # macro-F1 is the classifier's (the system report has none); false alerts
        # are the whole system's when the report has them. An older or partial
        # report leaves a figure out rather than failing the whole page.
        false_alerts = (r.get("system") or main).get("false_alerts_per_10k_benign_flows")
        parts = ([f"Macro-F1 {main['macro_f1']:.3f}"] if "macro_f1" in main else []) + (
            [f"{false_alerts} false alerts per 10k benign flows"] if false_alerts is not None else [])
        summary = " · ".join(parts) or "No evaluation figures in this report"
        history.append({
            "version": version,
            "title": f"Model Bundle {version}",
            "date": r.get("generated", "")[:10],
            "status": "active" if version == active_version else "superseded",
            "summary": summary,
            "highlights": [
                {"label": "Held-Out PortScan LOFO",
                 "after": _figure(portscan.get("caught_by_full_system"),
                                  portscan.get("caught_by_full_system_support"))},
                {"label": "Unseen Attacks Alerted",
                 "after": _figure(nf.get("alerted"), nf.get("alerted_support"))},
                {"label": "Unseen Shown as Unknown",
                 "after": _figure(nf.get("shown_as_unknown"), nf.get("shown_as_unknown_support"))},
            ],
            "changelog": [],
        })

    # newest first: v-prefixed bundles (v1, v2) after bare release numbers (1.2, 2.1)
    def sort_key(x):
        v = x["version"]
        return (1, v) if v.startswith("v") else (0, v)

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
        "version_history": _version_history(),
        "version_history_note": VERSION_HISTORY_NOTE,
    }

