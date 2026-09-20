"""Why this flow was flagged. SHAP when available, z-scores otherwise."""
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

    def top(self, x_row, k=3):
        x = np.asarray(x_row, dtype="float64").ravel()
        if self.shap is not None:
            try:
                values = np.asarray(self.shap.shap_values(x.reshape(1, -1)))
                impact = np.abs(values).reshape(-1, len(self.features)).max(axis=0)
            except Exception:
                impact = np.abs((x - self.benign_mean) / self.benign_std)
        else:
            impact = np.abs((x - self.benign_mean) / self.benign_std)
        order = np.argsort(impact)[::-1][:k]
        return [{"feature": self.features[i],
                 "value": round(float(x[i]), 3),
                 "impact": round(float(impact[i]), 3)} for i in order]
