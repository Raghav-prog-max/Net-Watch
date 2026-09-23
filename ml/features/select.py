"""
ml/features/select.py
──────────────────────
Feature selection helpers.

Strategy:
  - Remove near-zero-variance features (already handled in clean.py for constants)
  - Remove features with >95% correlation with another feature
  - Use LightGBM feature importance to rank the remainder
  - Save the final feature list to models/<version>/feature_list.json
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

NON_FEATURES = {"Label", "family", "day", "block", "Timestamp", "Flow ID", "Source IP", "Destination IP", "Source Port"}
_CORR_THRESHOLD = 0.95

# ── Main repo compatibility ───────────────────────────────────────────────────
def feature_columns(df: pd.DataFrame) -> list:
    cols = [c for c in df.columns
            if c not in NON_FEATURES and pd.api.types.is_numeric_dtype(df[c])]
    return sorted(cols)

def matrix(df: pd.DataFrame, features: list) -> np.ndarray:
    return df[features].to_numpy(dtype="float32", copy=False)

# ── NetA Advanced Selection ───────────────────────────────────────────────────
def get_feature_columns(df: pd.DataFrame) -> list[str]:
    """Return numeric columns suitable for modelling."""
    return feature_columns(df)

def remove_correlated(
    df: pd.DataFrame,
    feature_cols: list[str],
    threshold: float = _CORR_THRESHOLD,
) -> list[str]:
    """
    Drop one of each pair of highly-correlated features.
    Returns pruned feature list.
    """
    X = df[feature_cols].astype("float32")
    corr_matrix = X.corr().abs()
    upper = corr_matrix.where(
        np.triu(np.ones(corr_matrix.shape, dtype=bool), k=1)
    )
    to_drop = {col for col in upper.columns if any(upper[col] > threshold)}
    kept = [c for c in feature_cols if c not in to_drop]
    print(f"[select] Correlation pruning: {len(feature_cols)} → {len(kept)} features "
          f"(dropped {len(to_drop)} with r > {threshold})")
    return kept

def rank_by_importance(
    df_train: pd.DataFrame,
    feature_cols: list[str],
    label_col: str = "family",
    top_n: Optional[int] = None,
) -> list[str]:
    """
    Rank features by LightGBM split-gain importance.
    Returns ordered feature list (most important first).
    """
    import lightgbm as lgb
    from sklearn.preprocessing import LabelEncoder

    X = df_train[feature_cols].astype("float32")
    le = LabelEncoder()
    y = le.fit_transform(df_train[label_col])

    clf = lgb.LGBMClassifier(
        n_estimators=100,
        num_leaves=31,
        n_jobs=-1,
        verbose=-1,
        class_weight="balanced",
    )
    clf.fit(X, y)

    importance = pd.Series(clf.feature_importances_, index=feature_cols)
    ranked = importance.sort_values(ascending=False)

    if top_n is not None:
        ranked = ranked.head(top_n)

    print(f"[select] Top 10 features by importance:\n{ranked.head(10).to_string()}")
    return ranked.index.tolist()

def select_features(
    df_train: pd.DataFrame,
    top_n: Optional[int] = None,
    save: bool = True,
    version: str = "v1",
) -> list[str]:
    """
    Full feature selection pipeline.
    Returns final feature list; optionally saves to models/<version>/feature_list.json.
    """
    cols = get_feature_columns(df_train)
    cols = remove_correlated(df_train, cols)
    cols = rank_by_importance(df_train, cols, top_n=top_n)

    if save:
        out_dir = Path("models") / version
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "feature_list.json"
        with open(out_path, "w") as fh:
            json.dump(cols, fh, indent=2)
        print(f"[select] Feature list saved to {out_path}  ({len(cols)} features)")

    return cols
