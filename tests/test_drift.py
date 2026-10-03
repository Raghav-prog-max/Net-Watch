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

from ml.drift.monitor import bin_counts, psi, reference_stats, status, window_psi
import replay.replayer as replayer
from replay.replayer import drift_ramp, perturb, pick

RNG = np.random.default_rng(9)
# columns the drift scenario moves: two timings, a packet size, and a variance
SHIFTED = ["Flow Duration", "Flow IAT Mean", "Fwd Packet Length Mean", "Packet Length Variance"]


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


def test_traffic_past_the_reference_range_reads_as_drift():
    """np.histogram dropped values outside the reference edges, so half a window
    beyond the reference maximum disappeared and the other half still matched:
    PSI 0.007, Stable."""
    X = _lognormal()
    ref = reference_stats(X, SHIFTED)
    window = _lognormal()
    window[:2000] = X.max(axis=0) * 5
    got = window_psi(window, SHIFTED, ref)
    assert status(got)["status"] == "drift", got
    assert min(got.values()) > 0.25


def test_traffic_below_the_reference_range_counts_too():
    X = _lognormal()
    ref = reference_stats(X, SHIFTED)
    window = _lognormal()
    window[:2000] = X.min(axis=0) / 5
    assert status(window_psi(window, SHIFTED, ref))["status"] == "drift"


def test_bin_counts_match_histogram_inside_the_range():
    """Saved reference_stats.json counts came from np.histogram; inside the
    range the open-ended bins must count exactly the same, edges included."""
    X = _lognormal(n=3000, d=1)[:, 0]
    edges = np.unique(np.quantile(X, np.linspace(0, 1, 11)))
    on_edges = np.concatenate([X, edges])           # values sitting on every edge
    expected, _ = np.histogram(on_edges, bins=edges)
    assert bin_counts(on_edges, edges).tolist() == expected.tolist()


def test_bin_counts_skip_missing_values():
    edges = [0.0, 1.0, 2.0, 3.0]
    assert bin_counts([0.5, np.nan, 2.5, -4.0, 9.0], edges).tolist() == [2, 0, 2]


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
# The drift scenario replays a perturbed copy of the test split's benign flows
# (data/splits/test.pkl); the day scenario replays the held-out day
# (data/splits/drift.pkl). The ramp tests call drift_ramp directly so they do
# not depend on what is in data/splits/.

def _frame(n=4000):
    cols = {c: np.exp(RNG.normal(0, 1, n)) * 100 for c in SHIFTED}
    cols["Flow Bytes/s"] = np.exp(RNG.normal(0, 1, n)) * 100       # bytes over time: unmoved
    cols["Flow Packets/s"] = np.exp(RNG.normal(0, 1, n)) * 100     # falls as flows stretch
    cols["Total Fwd Packets"] = np.exp(RNG.normal(0, 1, n)) * 100  # a count: never moved
    cols["family"] = "Benign"
    return pd.DataFrame(cols)


def _factors(df, out, col):
    return (out[col] / df.loc[out.index, col]).to_numpy()


def _with_splits(fn, test=None, drift=None):
    """Run fn with replayer.TEST_SPLIT and DRIFT_SPLIT pointing at these paths
    (a path that does not exist stands for a split training did not write)."""
    saved = replayer.TEST_SPLIT, replayer.DRIFT_SPLIT
    with tempfile.TemporaryDirectory() as tmp:
        replayer.TEST_SPLIT = Path(test) if test else Path(tmp) / "no-test.pkl"
        replayer.DRIFT_SPLIT = Path(drift) if drift else Path(tmp) / "no-drift.pkl"
        try:
            return fn()
        finally:
            replayer.TEST_SPLIT, replayer.DRIFT_SPLIT = saved


def test_perturb_scales_packet_sizes_and_stretches_durations():
    """The handbook's drift set: "a perturbed copy of test with scaled packet
    sizes and stretched durations". The old ramp scaled packet counts and
    bytes/s instead, and left packet sizes alone."""
    df = _frame(200)
    out = perturb(df, 2.0)
    for col in ("Flow Duration", "Flow IAT Mean", "Fwd Packet Length Mean"):
        assert np.allclose(out[col], df[col] * 2), col
    assert np.allclose(out["Packet Length Variance"], df["Packet Length Variance"] * 4)
    assert np.allclose(out["Flow Packets/s"], df["Flow Packets/s"] / 2), "same packets, longer flow"
    assert np.allclose(out["Flow Bytes/s"], df["Flow Bytes/s"]), "bigger packets over a longer flow"
    assert np.allclose(out["Total Fwd Packets"], df["Total Fwd Packets"])
    assert (out["family"] == "Benign").all()


def test_drift_scenario_perturbs_the_test_split():
    """It used to replay every processed flow's benign rows, training ones included."""
    df = _frame()
    test = _frame(3000).assign(split="test")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "test.pkl"
        test.to_pickle(path)
        out = _with_splits(lambda: pick(df, "drift", limit=2000), test=path)
    assert len(out) == 2000
    assert (out["split"] == "test").all()
    assert np.allclose(_factors(test, out, "Flow Duration")[-1], 3.0)


def test_drift_scenario_perturbs_test_even_when_there_is_a_held_out_day():
    """With a held-out day it replayed that day unchanged, and nothing had
    checked that an ordinary Monday trips the monitor. That is `day` now."""
    df = _frame()
    with tempfile.TemporaryDirectory() as tmp:
        test_path, day_path = Path(tmp) / "test.pkl", Path(tmp) / "drift.pkl"
        _frame(3000).to_pickle(test_path)
        _frame(300).assign(day="Monday").to_pickle(day_path)
        drift = _with_splits(lambda: pick(df, "drift", limit=200), test=test_path, drift=day_path)
        day = _with_splits(lambda: pick(df, "day", limit=200), test=test_path, drift=day_path)
    assert "day" not in drift.columns, "drift should be the perturbed test split"
    assert len(day) == 200 and (day["day"] == "Monday").all(), "day replays the held-out day"


def test_day_scenario_without_a_held_out_day_says_so():
    import pytest
    with pytest.raises(SystemExit, match="Use --scenario drift"):
        _with_splits(lambda: pick(_frame(), "day", limit=10))


def test_drift_scenario_falls_back_to_all_flows_without_a_test_split():
    df = _frame()
    out = _with_splits(lambda: pick(df, "drift", limit=2000))
    assert len(out) == 2000
    assert np.allclose(_factors(df, out, "Flow Duration")[-1], 3.0)


def test_drift_scenario_ramps_rather_than_stepping():
    """The original applied one scalar per column: an instant step, not the
    gradual shift its comment described, and too small to register at all."""
    df = _frame()
    out = drift_ramp(df, limit=2000)
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
    out = drift_ramp(df, limit=2000)
    f = _factors(df, out, "Flow Duration")
    hold = f[250:1000]                       # after the climb, before the ramp
    assert np.allclose(hold, hold[0]), "the moderate shift should be held flat"
    assert 1.1 < hold[0] < 1.5

    ref = reference_stats(df[SHIFTED].to_numpy(), SHIFTED)
    got = window_psi(out[SHIFTED].to_numpy()[250:1000], SHIFTED, ref)
    assert status(got)["status"] == "warning", f"the hold reads as {got}"


def test_drift_scenario_respects_the_limit():
    """The ramp has to fit inside what the replayer actually sends, or it is cut
    off during the baseline and never reaches drift."""
    df = _frame()
    out = drift_ramp(df, limit=1500)
    assert len(out) == 1500
    assert np.allclose(_factors(df, out, "Flow Duration")[-1], 3.0), (
        "the last flow sent must be at the peak shift")


def test_drift_scenario_is_large_enough_to_be_detected():
    """End of the replay vs baseline, measured the way the monitor measures it."""
    df = _frame()
    out = drift_ramp(df, limit=2000)
    ref = reference_stats(df[SHIFTED].to_numpy(), SHIFTED)
    tail = out[SHIFTED].to_numpy()[-500:]
    got = window_psi(tail, SHIFTED, ref)
    assert status(got)["status"] == "drift", f"peak shift only reached {got}"


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        t()
    print(f"drift tests passed ({len(TESTS)} cases)")
