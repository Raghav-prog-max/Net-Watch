"""Isolation Forest trained on benign traffic only.

This is what lets NetWatch flag attacks the classifier has never seen. It never
sees an attack during training, so an unfamiliar attack simply looks abnormal.
"""
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


class AnomalyDetector:
    def __init__(self, n_estimators=200, max_samples=50000, random_state=42):
        self.scaler = StandardScaler()
        self.model = IsolationForest(
            n_estimators=n_estimators, max_samples=max_samples,
            contamination="auto", n_jobs=-1, random_state=random_state)
        self.threshold = None
        self.benign_scores = None

    def fit(self, X_benign):
        Xs = self.scaler.fit_transform(X_benign)
        self.model.fit(Xs)
        return self

    def score(self, X):
        """Higher means more abnormal."""
        return -self.model.score_samples(self.scaler.transform(X))

    def calibrate(self, X_benign_val, flag_rate=0.01):
        """Pick the cut-off from benign validation traffic, not from attacks."""
        self.benign_scores = np.sort(self.score(X_benign_val))
        self.threshold = float(np.quantile(self.benign_scores, 1.0 - flag_rate))
        return self.threshold

    def percentile(self, scores):
        """Where a score sits among benign traffic, 0..1. Feeds the severity score."""
        if self.benign_scores is None:
            return np.zeros_like(scores)
        return np.searchsorted(self.benign_scores, scores) / max(len(self.benign_scores), 1)

    def is_anomalous(self, scores):
        return scores >= (self.threshold if self.threshold is not None else np.inf)
