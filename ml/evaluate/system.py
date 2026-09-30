"""False alerts of the whole system: what an analyst actually sees.

`ml/models/combine.decide` raises an alert when the classifier's attack score
passes its threshold OR the anomaly detector flags the flow. The FPR budget is a
promise about analyst workload, so it has to be judged on that union. The
classifier's own rate is only one part of it: the detector is calibrated
separately (`anomaly.benign_flag_rate`) and its flags come on top.

This module measures the union, and compares ways of splitting one budget
between the two models (the handbook's risk plan: "raise its threshold and show
the recall/FPR trade-off openly").
"""
from __future__ import annotations

import numpy as np

from ml.evaluate.thresholds import pick_threshold

# (classifier FPR budget, detector benign flag rate) pairs for the trade-off
# table, besides the configured pair. Each spends at most 0.5% in total.
BUDGET_SPLITS = [(0.005, 0.0), (0.004, 0.001), (0.0025, 0.0025), (0.001, 0.004)]
# The configuration before 30 Sep 2026, kept in the table for comparison: the
# classifier alone used the whole budget and the detector's 1% came on top.
PREVIOUS_SPLIT = (0.005, 0.01)


def classifier_budget(cfg):
    """The classifier's share of the false-alert budget. Configs from before the
    split existed gave the classifier the whole budget."""
    return cfg["train"].get("classifier_fpr_budget", cfg["train"]["fpr_budget"])


def summary(is_benign, by_classifier, by_detector, budget):
    """Benign false alerts of the full decision, and where they come from."""
    b = np.asarray(is_benign, dtype=bool)
    clf = np.asarray(by_classifier, dtype=bool)
    det = np.asarray(by_detector, dtype=bool)
    alert = clf | det
    if not b.any():
        return {"benign_flows": 0}
    fpr = float(alert[b].mean())
    return {
        "benign_flows": int(b.sum()),
        "false_positive_rate": round(fpr, 5),
        "false_alerts_per_10k_benign_flows": round(fpr * 10000, 1),
        "from_classifier_per_10k": round(float(clf[b].mean()) * 10000, 1),
        "from_detector_only_per_10k": round(float((det & ~clf)[b].mean()) * 10000, 1),
        "attack_flows_alerted": round(float(alert[~b].mean()), 4) if (~b).any() else None,
        "budget_per_10k": round(budget * 10000, 1),
        "within_budget": fpr <= budget,
    }


def detector_threshold(detector, flag_rate):
    """The detector cut-off that flags `flag_rate` of benign validation traffic.
    0 switches the detector off."""
    if flag_rate <= 0:
        return np.inf
    return float(np.quantile(detector.benign_scores, 1.0 - flag_rate))


def splits(configured):
    """The configured (classifier budget, detector rate) pair first, then the others."""
    configured = tuple(float(v) for v in configured)
    return [configured] + [s for s in BUDGET_SPLITS + [PREVIOUS_SPLIT] if s != configured]


def thresholds_for(split, val_is_attack, val_attack_score, detector):
    """Both cut-offs for one budget split, chosen on validation only."""
    clf_budget, flag_rate = split
    thr = pick_threshold(val_is_attack, val_attack_score, clf_budget, verbose=False)
    return thr["threshold"], detector_threshold(detector, flag_rate)
