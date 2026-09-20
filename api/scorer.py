"""Loads the trained artefacts and turns flows into alerts."""
import json
import time
import uuid
from collections import deque
from pathlib import Path

import joblib
import numpy as np

from ml.drift.monitor import status as drift_status, window_psi
from ml.explain import Explainer
from ml.models import classifier as clf_mod
from ml.models.combine import decide


class Scorer:
    def __init__(self, model_dir="models/v1", drift_window=5000):
        d = Path(model_dir)
        bundle = joblib.load(d / "classifier.joblib")
        self.model, self.features, self.kind = bundle["model"], bundle["features"], bundle["kind"]
        self.detector = joblib.load(d / "anomaly.joblib")
        # Older model directories predate the label check; without it the scorer
        # still runs, it just never rejects a family label.
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

    def _matrix(self, flows):
        return np.array([[float(f.get(name, 0.0)) for name in self.features] for f in flows],
                        dtype="float32")

    def score(self, flows, metas=None):
        """flows: list of {feature: value}. Returns a list of alerts (may be empty)."""
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

        alerts = []
        for i in range(len(X)):
            core = decide(float(attack[i]), str(fam[i]), float(conf[i]), float(anom[i]),
                          float(pct[i]), bool(flagged[i]),
                          self.thresholds["attack_threshold"], bool(ood[i]))
            self.alert_history.append(1 if core else 0)
            if not core:
                # drift is tracked on traffic we consider benign, so a busy attack
                # hour does not read as distribution drift
                self.window.append(X[i])
                continue
            meta = (metas[i] if metas else {}) or {}
            alerts.append({
                "id": f"alt_{uuid.uuid4().hex[:10]}",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "flow": {k: str(v) for k, v in meta.items()},
                **core,
                "explanation": self.explainer.top(X[i]),
                "status": "open",
                "analyst_label": None,
                "analyst_note": None,
                "model_version": self.version,
            })
        return alerts

    def drift(self):
        if len(self.window) < 500:
            return {"status": "warming_up", "flows_seen": len(self.window)}
        psi = window_psi(np.array(self.window), self.features, self.reference)
        out = drift_status(psi)
        out["alert_rate"] = round(float(np.mean(self.alert_history)), 4)
        out["flows_seen"] = len(self.window)
        return out
