"""Loads the trained artefacts from `make train` and turns flows into alerts.

The decision itself lives in ml/models/combine.py so the API and the offline
evaluation make exactly the same call on a flow.
"""
import json
import os
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

from ml.drift.monitor import status as drift_status, window_psi
from ml.explain import Explainer
from ml.models import classifier as clf_mod
from ml.models.combine import decide
from .mitre import get_mitre_dict

# Resolved from the repository root, so the API finds its models whatever
# directory uvicorn is started from.
ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = os.environ.get("NETWATCH_MODEL_DIR", str(ROOT / "models" / "v1"))

FAMILY_WEIGHT = {
    "DDoS": 1.0, "Bot": 1.0, "WebAttack": 0.9, "DoS": 0.85,
    "BruteForce": 0.8, "Unknown": 0.8, "PortScan": 0.5
}

def severity_logic(confidence: float, anomaly_pct: float, family: str):
    weight = FAMILY_WEIGHT.get(family, 0.5)
    s = 100 * (0.5 * confidence + 0.3 * anomaly_pct + 0.2 * weight)
    if s >= 85:
        level = "Critical"
    elif s >= 65:
        level = "High"
    elif s >= 40:
        level = "Medium"
    else:
        level = "Low"
    return round(s), level


class ModelsNotFound(RuntimeError):
    """No trained artefacts at the model directory; run `make train`."""


class Scorer:
    def __init__(self, model_dir: str = MODEL_DIR, drift_window: int = 5000):
        d = Path(model_dir)
        if not (d / "classifier.joblib").exists():
            raise ModelsNotFound(f"no trained models in {d}; run `make train` first")
        bundle = joblib.load(d / "classifier.joblib")
        self.model, self.features = bundle["model"], bundle["features"]
        self.detector = joblib.load(d / "anomaly.joblib")
        # Model directories from before the label check still load; the scorer then
        # never rejects a family label.
        npath = d / "novelty.joblib"
        self.novelty = joblib.load(npath) if npath.exists() else None
        self.thresholds = json.load(open(d / "thresholds.json"))
        ref = json.load(open(d / "reference_stats.json"))
        self.reference = ref["bins"]
        self.version = d.name
        self.explainer = Explainer(self.model, self.features,
                                   ref["benign_mean"], ref["benign_std"])
        self.window = deque(maxlen=drift_window)
        self.alert_history = deque(maxlen=drift_window)

    def _matrix(self, flows: List[Dict[str, float]]) -> np.ndarray:
        return np.array([[float(f.get(name, 0.0)) for name in self.features] for f in flows],
                        dtype="float32").reshape(len(flows), len(self.features))

    def score(self, flows: List[Dict[str, float]],
              metas: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """flows: list of {feature: value}. Returns the alerts; benign flows produce none."""
        if not flows:
            return []
        X = self._matrix(flows)
        proba = self.model.predict_proba(X)
        attack, _ = clf_mod.attack_score(self.model, X)
        fam, conf = clf_mod.predicted_family(self.model, proba)
        anom = self.detector.score(X)
        pct = self.detector.percentile(anom)
        flagged = self.detector.is_anomalous(anom)
        if self.novelty is not None:
            ood = self.novelty.is_out_of_family(self.novelty.distance(X, fam), fam)
        else:
            ood = np.zeros(len(X), dtype=bool)

        decided = []
        for i in range(len(X)):
            core = decide(float(attack[i]), str(fam[i]), float(conf[i]), float(anom[i]),
                          float(pct[i]), bool(flagged[i]),
                          self.thresholds["attack_threshold"], bool(ood[i]))
            self.alert_history.append(1 if core else 0)
            if core:
                decided.append((i, core))
            else:
                # drift is tracked on traffic we consider benign, so a busy attack
                # hour does not read as distribution drift
                self.window.append(X[i])
        if not decided:
            return []

        # one SHAP call for the whole batch: per-row calls cost ~6x as much and
        # could not keep up with the replayer during an attack burst
        reasons = self.explainer.top_batch(X[[i for i, _ in decided]])
        alerts = []
        for (i, core), explanation in zip(decided, reasons):
            meta = (metas[i] if metas else None) or {}
            prediction = dict(core["prediction"])
            prediction["also_abnormal"] = core["also_abnormal"]
            if "rejected_label" in core:
                prediction["rejected_label"] = core["rejected_label"]
            alerts.append({
                "id": f"alt_{uuid.uuid4().hex[:10]}",
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "flow": {k: str(v) for k, v in meta.items()},
                "prediction": prediction,
                "anomaly_score": core["anomaly_score"],
                "is_novel": core["is_novel"],
                "severity": core["severity"],
                "explanation": explanation,
                # the API's MITRE service is the one the dashboard and tests agree on
                "mitre": get_mitre_dict(prediction["family"]),
                "recommended_action": core["recommended_action"],
                "status": "open",
                "analyst_label": None,
                "analyst_note": None,
                "model_version": self.version,
            })
        return alerts

    def drift(self) -> Dict[str, Any]:
        if len(self.window) < 500:
            return {"status": "warming_up", "flows_seen": len(self.window)}
        psi = window_psi(np.array(self.window), self.features, self.reference)
        alert_rate = round(float(np.mean(self.alert_history)), 4)
        # baseline_alert_rate is the FPR budget (≈ expected benign alert rate);
        # a simple heuristic until the model card stores the training alert rate.
        baseline = self.thresholds.get("fpr_budget", 0.005)
        out = drift_status(psi, alert_rate=alert_rate, baseline_alert_rate=baseline)
        out["alert_rate"] = alert_rate
        out["flows_seen"] = len(self.window)
        return out


_scorer: Optional[Scorer] = None


def get_scorer() -> Scorer:
    """Loaded on first use, not at import, so the API starts (and its other routes
    work) on a fresh clone that has not trained models yet."""
    global _scorer
    if _scorer is None:
        _scorer = Scorer()
    return _scorer
