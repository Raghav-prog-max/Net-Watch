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


def test_one_noisy_feature_cannot_declare_drift():
    """Drift needs three features over the line, so a single noisy column only
    ever reaches warning -- otherwise every busy hour would page someone."""
    assert status({"a": 0.9, "b": 0.01, "c": 0.01})["status"] == "warning"
    assert status({"a": 0.9, "b": 0.3, "c": 0.3})["status"] == "drift"


# ---------------------------------------------------------------- the scenario

def _frame(n=4000):
    cols = {c: np.exp(RNG.normal(0, 1, n)) * 100 for c in SHIFTED}
    cols["Flow Packets/s"] = np.exp(RNG.normal(0, 1, n)) * 100    # never shifted
    cols["family"] = "Benign"
    return pd.DataFrame(cols)


def _factors(df, out, col):
    return (out[col] / df.loc[out.index, col]).to_numpy()


def test_drift_scenario_ramps_rather_than_stepping():
    """The original applied one scalar per column: an instant step, not the
    gradual shift its comment described, and too small to register at all."""
    df = _frame()
    out = pick(df, "drift", limit=2000)
    f = _factors(df, out, "Flow Duration")

    assert np.allclose(f[:100], 1.0), "the opening should be unshifted baseline"
    assert np.allclose(f[-100:], 3.0), "the close should hold the full shift"
    assert (np.diff(f) >= -1e-9).all(), "the shift must never step backwards"
    assert len(np.unique(np.round(f, 4))) > 50, "a ramp, not a handful of steps"


def test_drift_scenario_respects_the_limit():
    """The ramp has to fit inside what the replayer actually sends, or it is cut
    off during the baseline and never reaches drift."""
    df = _frame()
    out = pick(df, "drift", limit=1500)
    assert len(out) == 1500
    assert np.allclose(_factors(df, out, "Flow Duration")[-1], 3.0), (
        "the last flow sent must be at the peak shift")


def test_unrelated_features_are_left_alone():
    df = _frame()
    out = pick(df, "drift", limit=2000)
    assert np.allclose(_factors(df, out, "Flow Packets/s"), 1.0)


def test_drift_scenario_is_large_enough_to_be_detected():
    """End of the replay vs baseline, measured the way the monitor measures it."""
    df = _frame()
    out = pick(df, "drift", limit=2000)
    ref = reference_stats(df[SHIFTED].to_numpy(), SHIFTED)
    tail = out[SHIFTED].to_numpy()[-500:]
    got = window_psi(tail, SHIFTED, ref)
    assert status(got)["status"] == "drift", f"peak shift only reached {got}"


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        t()
    print(f"drift tests passed ({len(TESTS)} cases)")
