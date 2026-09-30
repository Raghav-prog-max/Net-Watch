import json
import os
import copy
from collections import Counter
from pathlib import Path

import yaml
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = Any  # type: ignore[misc,assignment]

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


VERSION_HISTORY = [
    {
        "version": "v1.2",
        "title": "Log-Scaled Anomaly Geometry, Batch TreeSHAP & Naive-Split Proof",
        "date": "2026-09-29",
        "status": "active",
        "commit": "367d39d",
        "summary": (
            "Resolved the Isolation Forest missing low-magnitude quiet attacks by applying signed log1p "
            "feature compression before standardisation, upgraded live scoring to single-call batch TreeSHAP, "
            "and added a 5-seed naive random split benchmark beside the 5-minute time-block split."
        ),
        "highlights": [
            {"label": "Held-Out PortScan LOFO", "before": "0.0% (historical synthetic)", "after": "99.7%"},
            {"label": "Unseen Attacks Alerted", "before": "51.5% (historical synthetic)", "after": "100.0%"},
            {"label": "Unseen Shown as Unknown", "before": "90.7% (historical synthetic)", "after": "93.2%"},
            {"label": "SHAP Batch Scoring", "before": "Per-row", "after": "~6x faster"},
        ],
        "changelog": [
            {
                "type": "fixed",
                "module": "ml/models/anomaly.py",
                "text": (
                    "Applied signed log1p compression (sign(X) * log1p(|X|)) prior to StandardScaler so heavy-tailed "
                    "byte and duration columns no longer crush quiet probes into the 51st percentile of benign traffic."
                ),
            },
            {
                "type": "fixed",
                "module": "ml/explain.py",
                "text": (
                    "Supported 3D SHAP array outputs (rows, features, classes) and replaced per-flow explanations "
                    "with a single top_batch() call per alert batch (~6x faster during attack bursts)."
                ),
            },
            {
                "type": "added",
                "module": "ml/evaluate/naive.py",
                "text": (
                    "Added 5-seed stratified random row split benchmark alongside the 5-minute temporal block split "
                    "to measure split-leakage inflation and block overlap."
                ),
            },
            {
                "type": "changed",
                "module": "api/services/scorer.py",
                "text": (
                    "Wired live POST /score directly through ml/models/combine.decide and calibrated the 5,000-flow "
                    "benign drift ramp (PSI >= 0.10 warning, >= 0.25 drift)."
                ),
            },
            {
                "type": "tradeoff",
                "module": "ml/evaluate/lofo.py",
                "text": (
                    "Recorded held-out Bot LOFO shift from 25.8% to 17.7%: compressing feature scale moves high-variance "
                    "Bot traffic closer to benign baseline."
                ),
            },
        ],
    },
    {
        "version": "v1.1",
        "title": "Out-of-Family Novelty Gate & Uncorroborated Label Rejection",
        "date": "2026-09-23",
        "status": "superseded",
        "commit": "0b55f56",
        "summary": (
            "Added per-family out-of-distribution distance checking (FamilyNovelty) and decoupled label rejection "
            "from anomaly detector corroboration so novel attacks are surfaced as Unknown instead of confident wrong labels."
        ),
        "highlights": [
            {"label": "Heartbleed Shown as Unknown", "before": "0.0% (historical synthetic)", "after": "100.0% (historical synthetic)"},
            {"label": "Novel Families Unknown Rate", "before": "0.0% (historical synthetic)", "after": "90.7% (historical synthetic)"},
            {"label": "Known-Family Relabel Cost", "before": "0.50% (historical synthetic)", "after": "0.80% (historical synthetic)"},
            {"label": "Family Keep Budget", "after": "99.0% quantile"},
        ],
        "changelog": [
            {
                "type": "added",
                "module": "ml/models/novelty.py",
                "text": (
                    "Implemented FamilyNovelty using median absolute robust z-scores (per-feature median and IQR) "
                    "calibrated at keep_rate = 0.99 per attack family on validation traffic."
                ),
            },
            {
                "type": "changed",
                "module": "ml/models/combine.py",
                "text": (
                    "Removed the requirement that the Isolation Forest also flag a flow before rejecting an out-of-family "
                    "classifier label, which previously suppressed 100% of Heartbleed rejections at a 1% benign flag rate."
                ),
            },
            {
                "type": "added",
                "module": "ml/features/select.py",
                "text": (
                    "Added correlation pruning, LightGBM importance ranking, sklearn feature pipelines, and TreeSHAP explainers."
                ),
            },
            {
                "type": "verified",
                "module": "tests/test_novelty.py",
                "text": (
                    "Added 14 regression and unit tests covering per-family distance calibration and all decide() branches."
                ),
            },
        ],
    },
    {
        "version": "v1.0",
        "title": "Initial Dual-Engine Baseline & 5-Minute Time-Block Split",
        "date": "2026-09-20",
        "status": "baseline",
        "commit": "d5fe2f7",
        "summary": (
            "Initial dual-engine IDS pairing a class-weighted LightGBM classifier over 6 known attack families "
            "with an unsupervised benign-only Isolation Forest, evaluated on non-overlapping 5-minute time blocks."
        ),
        "highlights": [
            {"label": "Temporal Split Granularity", "after": "5-min blocks (0% leak)"},
            {"label": "False-Positive Budget", "after": "FPR <= 0.005 (50/10k)"},
            {"label": "Benign Detector Flag Rate", "after": "1.0% val calibration"},
            {"label": "Known Families Covered", "after": "6 attack families"},
        ],
        "changelog": [
            {
                "type": "added",
                "module": "ml/data/clean.py",
                "text": (
                    "Dropped host identifiers (Flow ID, src_ip, dst_ip, src_port) prior to training so the classifier "
                    "cannot memorise lab IP addresses."
                ),
            },
            {
                "type": "added",
                "module": "ml/data/split.py",
                "text": (
                    "Grouped flows into 5-minute time blocks via GroupShuffleSplit; verified zero block overlap in "
                    "tests/test_split_leakage.py."
                ),
            },
            {
                "type": "added",
                "module": "ml/models/classifier.py",
                "text": (
                    "Defined attack_score as 1 - P(Benign) and selected the operating threshold from the validation ROC curve "
                    "within fpr_budget = 0.005."
                ),
            },
            {
                "type": "added",
                "module": "ml/models/anomaly.py",
                "text": (
                    "Fitted 200-tree Isolation Forest exclusively on benign training flows to detect unseen attack families."
                ),
            },
        ],
    },
    {
        "version": "v2.0",
        "title": "Analyst Supervision Loop & Candidate Promotion Gate",
        "date": "Planned",
        "status": "planned",
        "summary": (
            "Retraining candidate incorporating analyst false-positive and incident confirmations from SQLite. "
            "Promoted only if it beats v1.2 Macro-F1 on the identical 5-minute time-block test split within the FPR budget."
        ),
        "highlights": [
            {"label": "Supervision Input", "after": "SQLite triage labels"},
            {"label": "False-Positive Handling", "after": "Relabelled as Benign"},
            {"label": "Promotion Gate", "after": "Macro-F1 > v1.2 on test"},
            {"label": "Automated Blocking", "after": "0% (human gate only)"},
        ],
        "changelog": [
            {
                "type": "added",
                "module": "api/routes/alerts.py",
                "text": (
                    "Persisted analyst status, analyst_label, and analyst_note in SQLite via PATCH /alerts/{id} "
                    "to build the supervision dataset."
                ),
            },
            {
                "type": "changed",
                "module": "ml/train.py",
                "text": (
                    "Candidate retraining folds analyst-marked false positives back into the benign training set "
                    "and re-evaluates thresholds on the held-out time blocks."
                ),
            },
        ],
    },
]


# Measured figures on the active release, read from the current report so they
# follow retraining (e.g. on CICIDS2017) instead of staying at the numbers the
# release commit recorded.
_LIVE_HIGHLIGHTS = {
    "Held-Out PortScan LOFO": lambda r: next(
        (x["caught_by_full_system"] for x in r.get("lofo", []) if x.get("family") == "PortScan"), None),
    "Unseen Attacks Alerted": lambda r: r.get("novel_families", {}).get("alerted"),
    "Unseen Shown as Unknown": lambda r: r.get("novel_families", {}).get("shown_as_unknown"),
}

VERSION_HISTORY_NOTE = (
    "These are code releases of the one trained model bundle on disk (see `versions`), "
    "not separate models. 'before' figures and those of superseded releases are as recorded "
    "in each release's commit message; the active release's measured figures are read from "
    "reports/metrics.json. All figures so far come from synthetic data."
)


def _version_history(report):
    history = copy.deepcopy(VERSION_HISTORY)
    for entry in history:
        if entry["status"] != "active" or not report:
            continue
        for h in entry["highlights"]:
            value = _LIVE_HIGHLIGHTS.get(h["label"], lambda r: None)(report)
            if value is not None:
                h["after"] = f"{100 * value:.1f}%"
                h["source"] = "reports/metrics.json"
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

