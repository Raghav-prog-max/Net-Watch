"""ml/explain/shap_explain.py — why a flow was flagged.

SHAP (TreeExplainer) when available, z-scores against benign traffic otherwise.
Used by api/services/scorer.py through `from ml.explain import Explainer`.
"""
import numpy as np


class Explainer:
    def __init__(self, model, features, benign_mean, benign_std):
        self.features = list(features)
        self.benign_mean = np.asarray(benign_mean, dtype="float64")
        self.benign_std = np.where(np.asarray(benign_std, dtype="float64") == 0, 1.0,
                                   np.asarray(benign_std, dtype="float64"))
        self.shap = None
        try:
            import shap
            self.shap = shap.TreeExplainer(model)
        except Exception:
            self.shap = None   # falls back to z-scores; no crash, no silent wrong answer

    def _shap_impact(self, X):
        """|SHAP| per (row, feature), taking the largest over classes.

        shap has returned multiclass values in two layouts: a list of
        (rows, features) arrays, one per class, and, in newer versions, one
        (rows, features, classes) array. Flattening the new layout as if it were
        the old one mixes features with classes and names the wrong features.
        """
        n, f = X.shape
        values = self.shap.shap_values(X)
        if isinstance(values, list):
            return np.abs(np.stack(values)).max(axis=0)          # (classes, n, f)
        values = np.abs(np.asarray(values))
        if values.shape == (n, f):
            return values
        if values.ndim == 3 and values.shape[:2] == (n, f):
            return values.max(axis=2)                             # (n, f, classes)
        if values.ndim == 3 and values.shape[1:] == (n, f):
            return values.max(axis=0)                             # (classes, n, f)
        raise ValueError(f"unexpected SHAP shape {values.shape} for {n} rows x {f} features")

    def top_batch(self, X, k=3):
        """Top-k reasons for every row of X, with one SHAP call for the batch."""
        X = np.asarray(X, dtype="float64").reshape(-1, len(self.features))
        if len(X) == 0:
            return []
        impact = None
        if self.shap is not None:
            try:
                impact = self._shap_impact(X)
            except Exception:
                impact = None
        if impact is None:
            impact = np.abs((X - self.benign_mean) / self.benign_std)
        out = []
        for x, imp in zip(X, impact):
            order = np.argsort(imp)[::-1][:k]
            out.append([{"feature": self.features[i],
                         "value": round(float(x[i]), 3),
                         "impact": round(float(imp[i]), 3)} for i in order])
        return out

    def top(self, x_row, k=3):
        return self.top_batch(np.asarray(x_row).reshape(1, -1), k)[0]
