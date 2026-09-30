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


def ks_test(X_window, features, ref, top_n=15, rank=None):
    """KS statistic per feature vs. the training reference, largest first.

    `rank` = feature names, most important first (the classifier's
    importances): only its first `top_n` are tested, as the handbook asks.
    Without it every feature is tested and the `top_n` most shifted returned.

    Uses scipy.stats.ks_2samp when available; falls back to an empirical-CDF
    comparison so the monitor never crashes in minimal environments.
    """
    try:
        from scipy.stats import ks_2samp as _ks2
        _scipy = True
    except ImportError:
        _scipy = False

    X = np.asarray(X_window, dtype="float64")
    tested = set(rank[:top_n]) if rank is not None else None
    results = {}
    for i, name in enumerate(features):
        if name not in ref or (tested is not None and name not in tested):
            continue
        edges = np.asarray(ref[name]["edges"], dtype="float64")
        counts = np.asarray(ref[name]["counts"], dtype="float64")
        bin_mids = (edges[:-1] + edges[1:]) / 2
        ref_sample = np.repeat(bin_mids, counts.clip(0).astype(int))
        window_col = X[:, i]
        if len(ref_sample) < 2 or len(window_col) < 2:
            continue
        if _scipy:
            stat, pval = _ks2(ref_sample, window_col)
        else:
            all_vals = np.sort(np.concatenate([ref_sample, window_col]))
            ref_cdf = np.searchsorted(np.sort(ref_sample), all_vals, side="right") / len(ref_sample)
            win_cdf = np.searchsorted(np.sort(window_col), all_vals, side="right") / len(window_col)
            stat = float(np.max(np.abs(ref_cdf - win_cdf)))
            pval = None
        results[name] = {"ks_stat": round(float(stat), 4),
                         "p_value": round(float(pval), 4) if pval is not None else None}

    sorted_res = sorted(results.items(), key=lambda kv: kv[1]["ks_stat"], reverse=True)
    return [{"feature": k, **v} for k, v in sorted_res[:top_n]]


def status(psi_by_feature, warn=0.10, drift=0.25,
           alert_rate=None, baseline_alert_rate=None,
           fp_share=None,
           warn_alert_mult=1.5, drift_alert_mult=2.0):
    """Compute drift status from PSI values, alert rate, and FP share.

    Parameters
    ----------
    psi_by_feature      : dict {feature_name: psi_value}
    warn, drift         : PSI thresholds
    alert_rate          : current rolling alert rate (fraction of flows)
    baseline_alert_rate : alert rate on validation set, saved at training
    fp_share            : share of recent alerts marked false_positive
    warn_alert_mult     : alert-rate ratio for Warning (handbook: 1.5x)
    drift_alert_mult    : alert-rate ratio for Drift   (handbook: 2.0x)
    """
    values = sorted(psi_by_feature.items(), key=lambda kv: kv[1], reverse=True)
    drifting_psi = [k for k, v in values if v > drift]

    if len(drifting_psi) >= 3:
        psi_state = "drift"
    elif any(v > warn for _, v in values):
        psi_state = "warning"
    else:
        psi_state = "stable"

    rate_state = "stable"
    rate_detail = None
    if alert_rate is not None and baseline_alert_rate and baseline_alert_rate > 0:
        ratio = alert_rate / baseline_alert_rate
        if ratio >= drift_alert_mult:
            rate_state = "drift"
            rate_detail = f"alert rate {ratio:.1f}x baseline (>={drift_alert_mult}x)"
        elif ratio >= warn_alert_mult:
            rate_state = "warning"
            rate_detail = f"alert rate {ratio:.1f}x baseline (>={warn_alert_mult}x)"

    # The alert rate alone can raise a warning, not declare drift. It also rises
    # when a novel attack arrives, which is an incident, not a changed network;
    # drift needs the feature distributions (PSI) to have moved as well.
    if rate_state == "drift" and psi_state == "stable":
        rate_state = "warning"
        rate_detail += "; capped at warning while PSI is stable"

    _rank = {"stable": 0, "warning": 1, "drift": 2}
    state = max(psi_state, rate_state, key=lambda s: _rank[s])

    out = {
        "status": state,
        "psi_status": psi_state,
        "alert_rate_status": rate_state,
        "top_features": [{"feature": k, "psi": v} for k, v in values[:5]],
        "recommendation": (
            "Retrain with recent traffic and analyst labels, then promote only "
            "if it beats the current model" if state == "drift"
            else "No action needed" if state == "stable"
            else "Watch: review in the next window"
        ),
    }
    if rate_detail:
        out["alert_rate_detail"] = rate_detail
    if fp_share is not None:
        out["fp_share"] = round(float(fp_share), 4)
    return out
