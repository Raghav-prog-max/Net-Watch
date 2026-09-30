"""Loads the trained artefacts from `make train` and turns flows into alerts.

The decision itself lives in ml/models/combine.py so the API and the offline
evaluation make exactly the same call on a flow.
"""
import json
import os
import uuid
from collections import Counter, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import yaml

from ml.drift.monitor import ks_test, status as drift_status, window_psi
from ml.explain import Explainer
from ml.models import classifier as clf_mod
from ml.models.combine import decide
from .mitre import get_mitre_dict

# Resolved from the repository root, so the API finds its models whatever
# directory uvicorn is started from.
ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = os.environ.get("NETWATCH_MODEL_DIR", str(ROOT / "models" / "v1"))

# ml/config.yaml `drift`; these defaults apply only if a key is missing
DRIFT_DEFAULTS = {
    "window": 5000, "warn_psi": 0.10, "drift_psi": 0.25,
    "alert_rate_warning_multiplier": 1.5, "alert_rate_drift_multiplier": 2.0,
    "top_features_ks": 15, "history_every": 1000, "history_keep": 100,
}


def drift_config() -> Dict[str, Any]:
    path = ROOT / "ml" / "config.yaml"
    cfg = yaml.safe_load(open(path)) if path.exists() else {}
    return {**DRIFT_DEFAULTS, **(cfg.get("drift") or {})}


class ModelsNotFound(RuntimeError):
    """No trained artefacts at the model directory; run `make train`."""


class Scorer:
    def __init__(self, model_dir: str = MODEL_DIR, drift_cfg: Optional[Dict[str, Any]] = None):
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
        self.drift_cfg = {**DRIFT_DEFAULTS, **(drift_cfg if drift_cfg is not None else drift_config())}
        n = int(self.drift_cfg["window"])
        self.window = deque(maxlen=n)
        self.alert_history = deque(maxlen=n)
        # 1/0 per flow the classifier did not name as a known attack: was it
        # raised as Unknown? This is the rate the drift rule watches.
        self.unexplained_history = deque(maxlen=n)
        # family shown to the analyst per alert, over the same span of flows
        self.family_history = deque(maxlen=n)
        # the handbook's KS test runs on the most important features; models
        # without importances (none today) fall back to the most shifted ones
        imp = getattr(self.model, "feature_importances_", None)
        self.importance_rank = ([self.features[i] for i in np.argsort(imp)[::-1]]
                                if imp is not None else None)
        # drift over time: one snapshot every `history_every` flows scored
        self.flows_total = 0
        self.history = deque(maxlen=int(self.drift_cfg["history_keep"]))

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
            self.family_history.append(core["prediction"]["family"] if core else None)
            # a named attack burst is an attack, not a change in normal traffic
            if not (core and not core["is_novel"]):
                self.unexplained_history.append(1 if core else 0)
            if core:
                decided.append((i, core))
            else:
                # drift is tracked on traffic we consider benign, so a busy attack
                # hour does not read as distribution drift
                self.window.append(X[i])
        before, self.flows_total = self.flows_total, self.flows_total + len(X)
        every = int(self.drift_cfg["history_every"])
        if self.flows_total // every > before // every:
            self.history.append(self._snapshot())
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
                # stored with the alert for retraining; removed before the
                # alert is returned or broadcast
                "features": {name: float(X[i][j]) for j, name in enumerate(self.features)},
            })
        return alerts

    def family_mix(self) -> Dict[str, float]:
        """Share of each family among the alerts over the recent window."""
        fams = Counter(f for f in self.family_history if f is not None)
        total = sum(fams.values())
        return {f: round(c / total, 4) for f, c in fams.most_common()} if total else {}

    def _snapshot(self) -> Dict[str, Any]:
        d = self._status()
        top = d.get("top_features") or [{}]
        return {
            "flows_scored": self.flows_total,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "status": d["status"],
            "max_psi": top[0].get("psi"),
            "top_feature": top[0].get("feature"),
            "alert_rate": d.get("alert_rate"),
            "unexplained_alert_rate": d.get("unexplained_alert_rate"),
            "family_mix": self.family_mix(),
        }

    def drift(self) -> Dict[str, Any]:
        out = self._status()
        out["family_mix"] = self.family_mix()
        out["flows_scored"] = self.flows_total
        out["history"] = list(self.history)
        return out

    def _status(self) -> Dict[str, Any]:
        c = self.drift_cfg
        if len(self.window) < 500:
            return {"status": "warming_up", "flows_seen": len(self.window)}
        psi = window_psi(np.array(self.window), self.features, self.reference)
        alert_rate = round(float(np.mean(self.alert_history)), 4)
        unexplained = (round(float(np.mean(self.unexplained_history)), 4)
                       if self.unexplained_history else 0.0)
        # Measured on benign validation traffic by `make train`. Comparing against
        # the FPR budget instead read ordinary traffic as drift: the detector alone
        # flags about 1% of benign flows by design, twice the 0.5% budget.
        # Models trained before the baseline was saved fall back to that 1%.
        baseline = self.thresholds.get("benign_unexplained_alert_rate", 0.01)
        out = drift_status(psi, warn=c["warn_psi"], drift=c["drift_psi"],
                           alert_rate=unexplained, baseline_alert_rate=baseline,
                           warn_alert_mult=c["alert_rate_warning_multiplier"],
                           drift_alert_mult=c["alert_rate_drift_multiplier"])
        out["alert_rate"] = alert_rate
        out["unexplained_alert_rate"] = unexplained
        out["baseline_unexplained_alert_rate"] = baseline
        out["ks"] = ks_test(np.array(self.window), self.features, self.reference,
                            top_n=int(c["top_features_ks"]), rank=self.importance_rank)
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
