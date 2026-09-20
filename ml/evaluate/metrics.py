"""Metrics a SOC lead would ask for. Accuracy is reported last, on purpose."""
import numpy as np
from sklearn.metrics import (accuracy_score, average_precision_score, classification_report,
                             confusion_matrix, f1_score, roc_auc_score)


def per_class(y_true, y_pred, labels):
    rep = classification_report(y_true, y_pred, labels=labels,
                                output_dict=True, zero_division=0)
    return {k: {m: round(float(v[m]), 4) for m in ("precision", "recall", "f1-score", "support")}
            for k, v in rep.items() if k in labels}


def false_positive_rate(y_true, y_pred_is_attack):
    benign = np.asarray(y_true) == "Benign"
    if benign.sum() == 0:
        return 0.0
    return float(np.asarray(y_pred_is_attack)[benign].mean())


def auc_scores(y_true, proba, classes):
    out = {}
    for i, cls in enumerate(classes):
        binary = (np.asarray(y_true) == cls).astype(int)
        if binary.sum() == 0 or binary.sum() == len(binary):
            continue
        out[cls] = {
            "pr_auc": round(float(average_precision_score(binary, proba[:, i])), 4),
            "roc_auc": round(float(roc_auc_score(binary, proba[:, i])), 4),
        }
    return out


def summarise(y_true, y_pred, y_is_attack, proba, classes):
    fpr = false_positive_rate(y_true, y_is_attack)
    return {
        "per_class": per_class(y_true, y_pred, list(classes)),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "false_positive_rate": round(fpr, 5),
        "false_alerts_per_10k_benign_flows": round(fpr * 10000, 1),
        "auc": auc_scores(y_true, proba, list(classes)),
        "confusion_matrix": {
            "labels": list(classes),
            "rows": confusion_matrix(y_true, y_pred, labels=list(classes)).tolist(),
        },
        "accuracy_for_reference_only": round(float(accuracy_score(y_true, y_pred)), 4),
    }
