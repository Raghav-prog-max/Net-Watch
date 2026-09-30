"""The false-alert budget is judged on what analysts see: an alert from the
classifier OR the anomaly detector (ml/evaluate/system.py)."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.evaluate import system
from ml.models.anomaly import AnomalyDetector
from ml.models.combine import decide
from scripts.retrain import false_alerts_per_10k


def test_summary_counts_the_union_and_where_it_comes_from():
    benign = np.array([True] * 8 + [False] * 2)
    clf = np.array([1, 0, 0, 0, 0, 0, 0, 0, 1, 0], dtype=bool)
    det = np.array([1, 1, 1, 0, 0, 0, 0, 0, 0, 1], dtype=bool)
    s = system.summary(benign, clf, det, budget=0.2)
    assert s["benign_flows"] == 8
    assert s["false_alerts_per_10k_benign_flows"] == 3750.0      # 3 of 8 benign flows
    assert s["from_classifier_per_10k"] == 1250.0                # 1 of 8
    assert s["from_detector_only_per_10k"] == 2500.0             # 2 of 8, not the shared one
    assert s["attack_flows_alerted"] == 1.0
    assert s["within_budget"] is False


def test_summary_is_what_decide_turns_into_alerts():
    # the number reported must be the number of flows combine.decide raises
    rng = np.random.default_rng(0)
    n = 400
    score = rng.random(n)
    anomalous = rng.random(n) < 0.05
    raised = np.array([decide(score[i], "DoS", score[i], 0.5, 0.5, bool(anomalous[i]), 0.9)
                       is not None for i in range(n)])
    s = system.summary(np.ones(n, bool), score >= 0.9, anomalous, budget=0.005)
    assert s["false_positive_rate"] == pytest.approx(raised.mean(), abs=1e-5)


def test_detector_threshold_flags_the_asked_share_and_zero_switches_it_off():
    rng = np.random.default_rng(1)
    det = AnomalyDetector(n_estimators=20, max_samples=256)
    X = rng.normal(size=(2000, 4))
    det.fit(X)
    det.calibrate(X, flag_rate=0.01)
    scores = det.score(X)
    assert (scores >= system.detector_threshold(det, 0.01)).mean() == pytest.approx(0.01, abs=0.002)
    assert (scores >= system.detector_threshold(det, 0.001)).mean() <= 0.002
    assert not (scores >= system.detector_threshold(det, 0.0)).any()


def test_configured_split_comes_first_and_is_not_repeated():
    assert system.splits((0.005, 0.01))[0] == (0.005, 0.01)
    out = system.splits((0.004, 0.001))
    assert out[0] == (0.004, 0.001) and out.count((0.004, 0.001)) == 1
    assert all(c + d <= 0.005 + 1e-12 for c, d in system.BUDGET_SPLITS)


def test_promotion_check_uses_the_full_system_when_the_report_has_it():
    new = {"main": {"false_alerts_per_10k_benign_flows": 42.9},
           "system": {"false_alerts_per_10k_benign_flows": 109.0}}
    old = {"main": {"false_alerts_per_10k_benign_flows": 42.9}}
    assert false_alerts_per_10k(new) == 109.0
    assert false_alerts_per_10k(old) == 42.9
