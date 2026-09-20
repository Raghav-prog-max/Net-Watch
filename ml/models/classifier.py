"""Supervised classifier for known attack families."""
import numpy as np
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier


def build(kind="auto", random_state=42):
    """kind: auto | lightgbm | hist | rf. auto uses LightGBM when installed."""
    if kind in ("auto", "lightgbm"):
        try:
            from lightgbm import LGBMClassifier
            return "lightgbm", LGBMClassifier(
                n_estimators=400, learning_rate=0.08, num_leaves=63,
                class_weight="balanced", n_jobs=-1, random_state=random_state, verbose=-1)
        except ImportError:
            if kind == "lightgbm":
                raise
    if kind in ("auto", "hist"):
        return "hist", HistGradientBoostingClassifier(
            max_iter=300, learning_rate=0.1, class_weight="balanced",
            random_state=random_state)
    return "rf", RandomForestClassifier(
        n_estimators=300, class_weight="balanced_subsample",
        n_jobs=-1, random_state=random_state)


def baseline(random_state=42):
    return RandomForestClassifier(
        n_estimators=200, class_weight="balanced_subsample",
        n_jobs=-1, random_state=random_state)


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
