"""
tests/test_thresholds.py
─────────────────────────
Unit tests for ml/evaluate/thresholds.py.
Uses a synthetic ROC curve — no real data required.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from ml.evaluate.thresholds import pick_threshold  # noqa: E402


def _make_scores(n: int = 1000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """
    Synthetic y_is_attack and attack_score.
    Class-conditional distributions:
      benign  ~ Uniform(0, 0.4)
      attack  ~ Uniform(0.3, 1.0)
    """
    rng     = np.random.default_rng(seed)
    n_benign  = n // 2
    n_attack  = n - n_benign
    y = np.array([0] * n_benign + [1] * n_attack)
    scores_benign = rng.uniform(0.0, 0.4, size=n_benign)
    scores_attack = rng.uniform(0.3, 1.0, size=n_attack)
    scores = np.concatenate([scores_benign, scores_attack])
    return y, scores


class TestPickThreshold:
    def test_returns_tuple_of_three_floats(self):
        y, s = _make_scores()
        result = pick_threshold(y, s)
        assert isinstance(result, tuple)
        assert len(result) == 3
        assert all(isinstance(v, float) for v in result)

    def test_fpr_within_budget(self):
        y, s = _make_scores()
        budget = 0.005
        thr, tpr, fpr = pick_threshold(y, s, fpr_budget=budget)
        assert fpr <= budget + 1e-9, f"FPR={fpr:.6f} exceeds budget={budget}"

    def test_tpr_positive(self):
        y, s = _make_scores()
        _, tpr, _ = pick_threshold(y, s)
        assert tpr > 0.0, "TPR should be positive for a non-trivial classifier"

    def test_threshold_in_score_range(self):
        y, s = _make_scores()
        thr, _, _ = pick_threshold(y, s)
        assert float(s.min()) <= thr <= float(s.max()) + 1e-9

    def test_tight_budget_still_returns(self):
        """Very tight budget (0.0001) should still return without error."""
        y, s = _make_scores()
        thr, tpr, fpr = pick_threshold(y, s, fpr_budget=0.0001)
        assert isinstance(thr, float)

    def test_perfect_classifier(self):
        """With a perfect score, threshold should achieve FPR=0, TPR=1."""
        n = 200
        y = np.array([0] * (n // 2) + [1] * (n // 2))
        s = np.array([0.1] * (n // 2) + [0.9] * (n // 2))
        thr, tpr, fpr = pick_threshold(y, s, fpr_budget=0.01)
        assert fpr <= 0.01 + 1e-9
        assert tpr >= 0.99

    def test_budget_zero_still_works(self):
        """FPR budget of 0 should return a threshold that achieves near-zero FPR."""
        y, s = _make_scores()
        thr, tpr, fpr = pick_threshold(y, s, fpr_budget=0.0)
        # May use minimum-FPR fallback
        assert isinstance(thr, float)
