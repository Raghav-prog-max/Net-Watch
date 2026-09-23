"""
ml/evaluate/thresholds.py
──────────────────────────
Select the classifier alert threshold at a given FPR budget.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_curve


def pick_threshold(
    y_is_attack: np.ndarray,
    attack_score: np.ndarray,
    fpr_budget: float = 0.005,
) -> dict[str, float]:
    """
    Choose the decision threshold that maximises TPR while keeping FPR ≤ fpr_budget.
    """
    y = np.asarray(y_is_attack).astype(int)
    fpr, tpr, thr = roc_curve(y, attack_score)

    ok = fpr <= fpr_budget
    if not ok.any():
        best_idx = int(np.argmin(fpr))
        print(f"[thresholds] ⚠️  No point with FPR ≤ {fpr_budget:.3%}. Using min FPR.")
    else:
        best_idx = int(np.argmax(tpr[ok]))
        ok_indices = np.where(ok)[0]
        best_idx = ok_indices[best_idx]

    chosen_thr = float(np.clip(thr[best_idx], 0.0, 1.0))
    chosen_tpr = float(tpr[best_idx])
    chosen_fpr = float(fpr[best_idx])

    print(f"[thresholds] Chosen threshold={chosen_thr:.4f}  TPR={chosen_tpr:.3%}  FPR={chosen_fpr:.3%}")
    
    return {
        "threshold": chosen_thr,
        "recall_at_threshold": round(chosen_tpr, 4),
        "fpr_at_threshold": round(chosen_fpr, 5),
        "fpr_budget": fpr_budget,
    }
