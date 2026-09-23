"""
ml/explain/shap_explain.py
───────────────────────────
TreeSHAP wrapper for the LightGBM/RandomForest classifier.

Returns the top-N feature impacts per prediction in the format
expected by the alert schema:
  [{"feature": str, "value": float, "impact": float}, ...]

Performance note (from spec):
  TreeSHAP runs on alerts only (not on every flow). For the live demo,
  explanations are computed per alert in the scoring service. In
  high-throughput production, consider precomputing for demo flows.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


def explain(
    clf,
    X_row: np.ndarray,
    feature_names: list[str],
    class_idx: int | None = None,
    top_n: int = 6,
) -> list[dict[str, Any]]:
    """
    Compute TreeSHAP values for a single flow and return top-N impacts.

    Parameters
    ----------
    clf          : fitted LGBMClassifier or RandomForestClassifier
    X_row        : 2-D numpy array of shape (1, n_features)
    feature_names: feature column names matching X_row columns
    class_idx    : class index to explain (default: argmax predicted class)
    top_n        : number of features to return

    Returns
    -------
    List of dicts sorted by |impact| descending:
      [{"feature": str, "value": float, "impact": float}, ...]
    """
    import shap

    # Use TreeExplainer for tree models (fast, exact)
    explainer = shap.TreeExplainer(clf)
    shap_vals  = explainer.shap_values(X_row)

    # shap_values shape depends on model type:
    #   LightGBM multiclass: list of (n_samples, n_features), one per class
    #   RandomForest:        same
    if isinstance(shap_vals, list):
        if class_idx is None:
            proba = clf.predict_proba(X_row)[0]
            class_idx = int(np.argmax(proba))
        vals = shap_vals[class_idx][0]  # shape (n_features,)
    else:
        vals = shap_vals[0]

    # Build explanation list
    impacts = list(zip(feature_names, X_row[0], vals))
    impacts.sort(key=lambda x: abs(x[2]), reverse=True)

    return [
        {
            "feature": feat,
            "value":   round(float(val),    4),
            "impact":  round(float(impact), 4),
        }
        for feat, val, impact in impacts[:top_n]
    ]


def batch_explain(
    clf,
    X: np.ndarray,
    feature_names: list[str],
    class_indices: np.ndarray | None = None,
    top_n: int = 6,
) -> list[list[dict[str, Any]]]:
    """
    Compute TreeSHAP explanations for multiple flows.
    Uses a single TreeExplainer call for efficiency.

    Parameters
    ----------
    X             : numpy array (n_samples, n_features)
    class_indices : per-sample class index to explain; defaults to argmax

    Returns
    -------
    List of explanation lists, one per sample.
    """
    import shap

    explainer = shap.TreeExplainer(clf)
    shap_vals  = explainer.shap_values(X)

    if class_indices is None:
        class_indices = np.argmax(clf.predict_proba(X), axis=1)

    results = []
    for i in range(len(X)):
        if isinstance(shap_vals, list):
            vals = shap_vals[class_indices[i]][i]
        else:
            vals = shap_vals[i]

        impacts = list(zip(feature_names, X[i], vals))
        impacts.sort(key=lambda x: abs(x[2]), reverse=True)

        results.append([
            {
                "feature": feat,
                "value":   round(float(val),    4),
                "impact":  round(float(impact), 4),
            }
            for feat, val, impact in impacts[:top_n]
        ])

    return results
