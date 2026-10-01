"""The drift monitor has to notice real drift and stay quiet otherwise, and the
demo scenario has to actually produce drift for it to notice.

Run: python tests/test_drift.py   (or pytest tests/)
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd

from ml.drift.monitor import psi, reference_stats, status, window_psi
import replay.replayer as replayer
from replay.replayer import pick, synthetic_drift

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
# The drift scenario replays the held-out drift day (data/splits/drift.pkl) when
# training wrote one, and a synthetic ramp otherwise. The ramp tests call
# synthetic_drift directly so they do not depend on what is in data/splits/.

def _frame(n=4000):
    cols = {c: np.exp(RNG.normal(0, 1, n)) * 100 for c in SHIFTED}
    cols["Flow Packets/s"] = np.exp(RNG.normal(0, 1, n)) * 100    # never shifted
    cols["family"] = "Benign"
    return pd.DataFrame(cols)


def _factors(df, out, col):
    return (out[col] / df.loc[out.index, col]).to_numpy()


def _with_drift_split(path, fn):
    """Run fn with replayer.DRIFT_SPLIT pointing at path."""
    saved = replayer.DRIFT_SPLIT
    replayer.DRIFT_SPLIT = Path(path)
    try:
        return fn()
    finally:
        replayer.DRIFT_SPLIT = saved


def test_drift_scenario_replays_the_held_out_day_when_there_is_one():
    df = _frame()
    held_out = _frame(300).assign(day="Monday")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "drift.pkl"
        held_out.to_pickle(path)
        out = _with_drift_split(path, lambda: pick(df, "drift", limit=200))
    assert len(out) == 200
    assert (out["day"] == "Monday").all(), "should replay the split, not the ramp"


def test_drift_scenario_falls_back_to_the_ramp_without_a_split():
    """Synthetic data has no Monday, so training writes no drift split. The
    scenario used to send nothing at all then; it has to send the ramp."""
    df = _frame()
    with tempfile.TemporaryDirectory() as tmp:
        out = _with_drift_split(Path(tmp) / "missing.pkl",
                                lambda: pick(df, "drift", limit=2000))
    assert len(out) == 2000
    assert np.allclose(_factors(df, out, "Flow Duration")[-1], 3.0)


def test_drift_scenario_ramps_rather_than_stepping():
    """The original applied one scalar per column: an instant step, not the
    gradual shift its comment described, and too small to register at all."""
    df = _frame()
    out = synthetic_drift(df, limit=2000)
    f = _factors(df, out, "Flow Duration")

    assert np.allclose(f[:100], 1.0), "the opening should be unshifted baseline"
    assert np.allclose(f[-100:], 3.0), "the close should hold the full shift"
    assert (np.diff(f) >= -1e-9).all(), "the shift must never step backwards"
    assert len(np.unique(np.round(f, 4))) > 50, "a ramp, not a handful of steps"


def test_drift_scenario_holds_in_the_warning_band_before_the_peak():
    """A straight ramp went stable -> drift with no Warning in between: the
    unexplained alert rate passed 2x its baseline as soon as PSI passed 0.10.
    The scenario now holds a moderate shift first, and that hold has to read
    as Warning on its own -- not Stable, and not already Drift."""
    df = _frame()
    out = synthetic_drift(df, limit=2000)
    f = _factors(df, out, "Flow Duration")
    hold = f[250:1000]                       # after the climb, before the ramp
    assert np.allclose(hold, hold[0]), "the moderate shift should be held flat"
    assert 1.3 < hold[0] < 2.0

    ref = reference_stats(df[SHIFTED].to_numpy(), SHIFTED)
    got = window_psi(out[SHIFTED].to_numpy()[250:1000], SHIFTED, ref)
    assert status(got)["status"] == "warning", f"the hold reads as {got}"


def test_drift_scenario_respects_the_limit():
    """The ramp has to fit inside what the replayer actually sends, or it is cut
    off during the baseline and never reaches drift."""
    df = _frame()
    out = synthetic_drift(df, limit=1500)
    assert len(out) == 1500
    assert np.allclose(_factors(df, out, "Flow Duration")[-1], 3.0), (
        "the last flow sent must be at the peak shift")


def test_unrelated_features_are_left_alone():
    df = _frame()
    out = synthetic_drift(df, limit=2000)
    assert np.allclose(_factors(df, out, "Flow Packets/s"), 1.0)


def test_drift_scenario_is_large_enough_to_be_detected():
    """End of the replay vs baseline, measured the way the monitor measures it."""
    df = _frame()
    out = synthetic_drift(df, limit=2000)
    ref = reference_stats(df[SHIFTED].to_numpy(), SHIFTED)
    tail = out[SHIFTED].to_numpy()[-500:]
    got = window_psi(tail, SHIFTED, ref)
    assert status(got)["status"] == "drift", f"peak shift only reached {got}"



TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        t()
    print(f"drift tests passed ({len(TESTS)} cases)")
