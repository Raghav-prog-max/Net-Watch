"""
tests/test_classifier.py
─────────────────────────
Smoke tests for the classifier module.
Fits on 200 synthetic rows; no real data required.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from ml.models.classifier import (  # noqa: E402
    train_rf, train_lgbm, attack_score, predict_family, predict_proba_df,
)
from ml.data.labels import TRAIN_FAMILIES as FAMILIES  # noqa: E402

_N = 200
_F = 20
_SEED = 0


def _make_data(n: int = _N, f: int = _F):
    rng = np.random.default_rng(_SEED)
    X   = rng.random((n, f)).astype("float32")
    y   = rng.integers(0, len(FAMILIES), size=n)
    return X, y


class TestRandomForest:
    def test_fit_predict(self):
        X, y = _make_data()
        clf  = train_rf(X, y)
        pred = clf.predict(X)
        assert pred.shape == (len(X),)

    def test_attack_score_range(self):
        X, y = _make_data()
        clf  = train_rf(X, y)
        s, _ = attack_score(clf, X)
        assert s.shape == (len(X),)
        assert float(s.min()) >= 0.0
        assert float(s.max()) <= 1.0

    def test_predict_family_returns_strings(self):
        X, y = _make_data()
        clf   = train_rf(X, y)
        preds = predict_family(clf, X, class_names=FAMILIES)
        assert len(preds) == len(X)
        assert all(isinstance(p, str) for p in preds)
        assert all(p in FAMILIES for p in preds)

    def test_proba_sums_to_one(self):
        X, y = _make_data()
        clf   = train_rf(X, y)
        proba = clf.predict_proba(X)
        sums  = proba.sum(axis=1)
        np.testing.assert_allclose(sums, 1.0, atol=1e-5)


class TestLightGBM:
    def test_fit_predict(self):
        pytest.importorskip("lightgbm")
        X, y = _make_data()
        clf  = train_lgbm(X, y, n_estimators=10)
        pred = clf.predict(X)
        assert pred.shape == (len(X),)

    def test_attack_score_shape(self):
        pytest.importorskip("lightgbm")
        X, y = _make_data()
        clf  = train_lgbm(X, y, n_estimators=10)
        s, _ = attack_score(clf, X)
        assert s.shape == (len(X),)

    def test_proba_df_columns(self):
        pytest.importorskip("lightgbm")
        X, y = _make_data()
        clf  = train_lgbm(X, y, n_estimators=10)
        df   = predict_proba_df(clf, X, class_names=FAMILIES)
        assert list(df.columns) == FAMILIES
        assert len(df) == len(X)

    def test_early_stopping_with_val(self):
        pytest.importorskip("lightgbm")
        X, y = _make_data(n=300)
        X_train, y_train = X[:200], y[:200]
        X_val,   y_val   = X[200:], y[200:]
        clf = train_lgbm(X_train, y_train, X_val, y_val, n_estimators=50)
        assert clf is not None
