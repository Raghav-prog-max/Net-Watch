"""
ml/models/classifier.py
────────────────────────
Random Forest baseline and LightGBM multiclass classifier.

Public API
──────────
  build(kind="auto", random_state=42) → (kind: str, clf)
  baseline(random_state=42) → clf
  train_rf(X_train, y_train, **kwargs)  → fitted RandomForestClassifier
  train_lgbm(X_train, y_train, X_val, y_val, **kwargs) → fitted LGBMClassifier
  attack_score(clf, X) → (score: np.ndarray, proba: np.ndarray)
  predicted_family(clf, proba) → (family: np.ndarray, confidence: np.ndarray)
  predict_proba_df(clf, X) → pd.DataFrame
  save(clf, path)
  load(path) → clf
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

try:
    import lightgbm as lgb
    _LGBM_AVAILABLE = True
except ImportError:
    _LGBM_AVAILABLE = False
    print("[classifier] ⚠️  lightgbm not installed – LightGBM training unavailable.")


# ── Default hyperparameters ────────────────────────────────────────────────────
_RF_DEFAULTS: dict[str, Any] = {
    "n_estimators": 300,
    "class_weight": "balanced_subsample",
    "n_jobs":       -1,
    "random_state": 42,
}

_LGBM_DEFAULTS: dict[str, Any] = {
    "n_estimators":  500,
    "learning_rate": 0.05,
    "num_leaves":    63,
    "class_weight":  "balanced",
    "n_jobs":        -1,
    "verbose":       -1,
    "random_state":  42,
}

def build(kind="auto", random_state=42):
    """kind: auto | lightgbm | rf."""
    if kind in ("auto", "lightgbm") and _LGBM_AVAILABLE:
        params = {**_LGBM_DEFAULTS, "random_state": random_state}
        return "lightgbm", lgb.LGBMClassifier(**params)
    
    params = {**_RF_DEFAULTS, "random_state": random_state}
    return "rf", RandomForestClassifier(**params)

def baseline(random_state=42):
    return RandomForestClassifier(
        n_estimators=200, class_weight="balanced_subsample",
        n_jobs=-1, random_state=random_state)


# ── Training ──────────────────────────────────────────────────────────────────
def train_rf(X_train: np.ndarray, y_train: np.ndarray, **kwargs) -> RandomForestClassifier:
    params = {**_RF_DEFAULTS, **kwargs}
    clf = RandomForestClassifier(**params)
    clf.fit(X_train, y_train)
    return clf


def train_lgbm(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: Optional[np.ndarray] = None, y_val: Optional[np.ndarray] = None,
    **kwargs
):
    if not _LGBM_AVAILABLE:
        raise ImportError("lightgbm is not installed. Run: pip install lightgbm")

    params = {**_LGBM_DEFAULTS, **kwargs}
    clf = lgb.LGBMClassifier(**params)

    fit_kwargs: dict[str, Any] = {}
    if X_val is not None and y_val is not None:
        fit_kwargs["eval_set"] = [(X_val, y_val)]
        fit_kwargs["callbacks"] = [
            lgb.early_stopping(stopping_rounds=30, verbose=True),
            lgb.log_evaluation(period=50),
        ]

    clf.fit(X_train, y_train, **fit_kwargs)
    return clf


# ── Scoring helpers (compatible with scorer.py) ───────────────────────────────
def attack_score(model, X):
    """P(not benign). Used for thresholding instead of argmax."""
    proba = model.predict_proba(X)
    classes = list(model.classes_)
    if "Benign" not in classes:
        return proba.max(axis=1), proba
    return 1.0 - proba[:, classes.index("Benign")], proba


def predicted_family(model, proba):
    """Most likely attack family, ignoring the Benign column."""
    classes = np.array(model.classes_)
    mask = classes != "Benign"
    idx = proba[:, mask].argmax(axis=1)
    return classes[mask][idx], proba[:, mask].max(axis=1)


def predict_family(clf, X: np.ndarray, class_names: Optional[list[str]] = None) -> list[str]:
    indices = np.argmax(clf.predict_proba(X), axis=1)
    names = class_names if class_names is not None else list(clf.classes_)
    return [names[i] for i in indices]


def predict_proba_df(clf, X: np.ndarray, class_names: Optional[list[str]] = None) -> pd.DataFrame:
    names = class_names if class_names is not None else list(clf.classes_)
    return pd.DataFrame(clf.predict_proba(X), columns=names)


# ── Persistence ───────────────────────────────────────────────────────────────
def save(clf, path: Path | str, meta: Optional[dict] = None) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, path)
    if meta:
        with open(path.with_suffix(".meta.json"), "w") as fh:
            json.dump(meta, fh, indent=2)

def load(path: Path | str):
    return joblib.load(Path(path))
