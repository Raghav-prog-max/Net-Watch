"""Population Stability Index per feature, plus alert-rate drift."""
import numpy as np


def reference_stats(X, features, bins=10):
    """Quantile bin edges and expected counts, saved at training time."""
    ref = {}
    X = np.asarray(X, dtype="float64")
    for i, name in enumerate(features):
        col = X[:, i]
        edges = np.unique(np.quantile(col, np.linspace(0, 1, bins + 1)))
        if len(edges) < 3:
            continue
        counts, _ = np.histogram(col, bins=edges)
        ref[name] = {"edges": edges.tolist(), "counts": counts.tolist()}
    return ref


def psi(expected_counts, actual_counts, eps=1e-6):
    e = np.asarray(expected_counts, dtype="float64")
    a = np.asarray(actual_counts, dtype="float64")
    e = e / max(e.sum(), 1) + eps
    a = a / max(a.sum(), 1) + eps
    return float(np.sum((a - e) * np.log(a / e)))


def window_psi(X_window, features, ref):
    X = np.asarray(X_window, dtype="float64")
    out = {}
    for i, name in enumerate(features):
        if name not in ref:
            continue
        edges = np.asarray(ref[name]["edges"], dtype="float64")
        counts, _ = np.histogram(X[:, i], bins=edges)
        out[name] = round(psi(ref[name]["counts"], counts), 4)
    return out


def status(psi_by_feature, warn=0.10, drift=0.25):
    values = sorted(psi_by_feature.items(), key=lambda kv: kv[1], reverse=True)
    drifting = [k for k, v in values if v > drift]
    if len(drifting) >= 3:
        state = "drift"
    elif any(v > warn for _, v in values):
        state = "warning"
    else:
        state = "stable"
    return {
        "status": state,
        "top_features": [{"feature": k, "psi": v} for k, v in values[:5]],
        "recommendation": ("Retrain with recent traffic and analyst labels, then promote only "
                           "if it beats the current model" if state == "drift"
                           else "No action needed" if state == "stable"
                           else "Watch: review in the next window"),
    }
