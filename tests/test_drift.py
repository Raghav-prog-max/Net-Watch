"""The drift monitor has to notice real drift and stay quiet otherwise, and the
demo scenario has to actually produce drift for it to notice.

Run: python tests/test_drift.py   (or pytest tests/)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd

from ml.drift.monitor import psi, reference_stats, status, window_psi
from replay.replayer import pick

RNG = np.random.default_rng(9)
SHIFTED = ["Flow Duration", "Flow IAT Mean", "Flow Bytes/s", "Total Fwd Packets"]


def _lognormal(shift=0.0, n=4000, d=4):
    return np.exp(RNG.normal(shift, 1.0, size=(n, d))) * 100


# ---------------------------------------------------------------- the monitor

def test_identical_traffic_reads_as_no_drift():
    X = _lognormal()
    ref = reference_stats(X, SHIFTED)
    got = window_psi(_lognormal(), SHIFTED, ref)
    assert max(got.values()) < 0.05, f"unshifted traffic scored PSI {max(got.values()):.3f}"


def test_psi_grows_with_the_size_of_the_shift():
    X = _lognormal()
    ref = reference_stats(X, SHIFTED)
    small = max(window_psi(_lognormal(0.3), SHIFTED, ref).values())
    large = max(window_psi(_lognormal(1.2), SHIFTED, ref).values())
    assert large > small * 3, f"PSI barely moved: {small:.3f} -> {large:.3f}"


def test_psi_of_identical_counts_is_zero():
    assert abs(psi([10, 20, 30], [10, 20, 30])) < 1e-9


def test_status_bands():
    assert status({"a": 0.02, "b": 0.01})["status"] == "stable"
    assert status({"a": 0.15, "b": 0.01})["status"] == "warning"


def test_alert_rate_at_its_baseline_is_stable():
    # the regression: ordinary traffic alerts at about its measured baseline and
    # used to read as "drift" because it was compared with the FPR budget
    calm = {"a": 0.02, "b": 0.01}
    assert status(calm, alert_rate=0.010, baseline_alert_rate=0.010)["status"] == "stable"
    assert status(calm, alert_rate=0.014, baseline_alert_rate=0.010)["status"] == "stable"


def test_alert_rate_alone_warns_but_cannot_declare_drift():
    calm = {"a": 0.02, "b": 0.01}
    assert status(calm, alert_rate=0.016, baseline_alert_rate=0.010)["status"] == "warning"
    out = status(calm, alert_rate=0.20, baseline_alert_rate=0.010)
    assert out["status"] == "warning"
    assert out["alert_rate_status"] == "warning"
    assert "capped" in out["alert_rate_detail"]


def test_alert_rate_with_moving_features_declares_drift():
    moving = {"a": 0.15, "b": 0.01}
    assert status(moving, alert_rate=0.03, baseline_alert_rate=0.010)["status"] == "drift"
    assert status(moving, alert_rate=0.010, baseline_alert_rate=0.010)["status"] == "warning"


def test_one_noisy_feature_cannot_declare_drift():
    """Drift needs three features over the line, so a single noisy column only
    ever reaches warning -- otherwise every busy hour would page someone."""
    assert status({"a": 0.9, "b": 0.01, "c": 0.01})["status"] == "warning"
    assert status({"a": 0.9, "b": 0.3, "c": 0.3})["status"] == "drift"


# ---------------------------------------------------------------- the scenario
# The drift scenario is now backed by a real held-out data split (data/splits/drift.pkl)
# rather than a synthetic ramp, so the synthetic ramp tests have been removed.


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        t()
    print(f"drift tests passed ({len(TESTS)} cases)")
