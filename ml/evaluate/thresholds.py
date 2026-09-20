"""Pick the alert threshold from an alert budget, never 0.5 by default."""
import numpy as np
from sklearn.metrics import roc_curve


def pick_threshold(y_is_attack, attack_score, fpr_budget=0.005):
    y = np.asarray(y_is_attack).astype(int)
    fpr, tpr, thr = roc_curve(y, attack_score)
    ok = fpr <= fpr_budget
    if not ok.any():
        return {"threshold": 0.5, "recall": None, "fpr": None, "note": "budget unreachable"}
    best = int(np.argmax(tpr[ok]))
    return {
        "threshold": float(np.clip(thr[ok][best], 0.0, 1.0)),
        "recall_at_threshold": round(float(tpr[ok][best]), 4),
        "fpr_at_threshold": round(float(fpr[ok][best]), 5),
        "fpr_budget": fpr_budget,
    }
