"""
ml/evaluate/thresholds.py
──────────────────────────
Select the classifier alert threshold at a given FPR budget.

Verbatim from spec:
  pick_threshold(y_is_attack, attack_score, fpr_budget=0.005)
  → maximises TPR subject to FPR ≤ fpr_budget

Also saves the chosen threshold (+ tpr, fpr) to models/<version>/thresholds.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_curve

_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT))

from ml.utils.config import cfg, MODELS_DIR  # noqa: E402


def pick_threshold(
    y_is_attack: np.ndarray,
    attack_score: np.ndarray,
    fpr_budget: float = cfg.fpr_budget,
) -> tuple[float, float, float]:
    """
    Choose the decision threshold that maximises TPR while keeping FPR ≤ fpr_budget.

    Parameters
    ----------
    y_is_attack  : binary array  (1 = attack, 0 = benign)
    attack_score : continuous score (1 − P(Benign)) per sample
    fpr_budget   : maximum allowed false-positive rate (default 0.005)

    Returns
    -------
    (threshold, tpr_at_threshold, fpr_at_threshold)
    """
    fpr, tpr, thr = roc_curve(y_is_attack, attack_score)

    # Only consider operating points with FPR within budget
    ok = fpr <= fpr_budget
    if not ok.any():
        # Fallback: use the point with the lowest FPR
        best_idx = int(np.argmin(fpr))
        print(
            f"[thresholds] ⚠️  No point with FPR ≤ {fpr_budget:.3%}. "
            f"Using minimum FPR point (FPR={fpr[best_idx]:.3%})."
        )
    else:
        # Within budget: maximise TPR
        best_idx = int(np.argmax(tpr[ok]))
        # Map back to global index
        ok_indices = np.where(ok)[0]
        best_idx = ok_indices[best_idx]

    chosen_thr = float(thr[best_idx])
    chosen_tpr = float(tpr[best_idx])
    chosen_fpr = float(fpr[best_idx])

    print(
        f"[thresholds] Chosen threshold={chosen_thr:.4f}  "
        f"TPR={chosen_tpr:.3%}  FPR={chosen_fpr:.3%}  "
        f"(≈ {chosen_fpr * 10_000:.0f} false alerts per 10,000 benign flows)"
    )
    return chosen_thr, chosen_tpr, chosen_fpr


def save_thresholds(
    threshold: float,
    tpr: float,
    fpr: float,
    anomaly_threshold: float,
    version: str = "v1",
) -> Path:
    """
    Persist threshold values to models/<version>/thresholds.json.
    Returns the path written.
    """
    out_dir = MODELS_DIR / version
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "thresholds.json"

    payload = {
        "classifier_threshold":  threshold,
        "tpr_at_threshold":      tpr,
        "fpr_at_threshold":      fpr,
        "fpr_budget":            cfg.fpr_budget,
        "false_alerts_per_10k":  round(fpr * 10_000, 1),
        "anomaly_threshold":     anomaly_threshold,
    }

    with open(out_path, "w") as fh:
        json.dump(payload, fh, indent=2)

    print(f"[thresholds] Saved to {out_path}")
    return out_path


def load_thresholds(version: str = "v1") -> dict:
    """Load thresholds.json for the given model version."""
    path = MODELS_DIR / version / "thresholds.json"
    if not path.exists():
        raise FileNotFoundError(f"thresholds.json not found at {path}. Run make train first.")
    with open(path) as fh:
        return json.load(fh)
