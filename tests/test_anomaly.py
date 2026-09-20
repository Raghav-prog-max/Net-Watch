"""The detector has to see quiet attacks, not just loud ones.

Flow features are heavy-tailed. Standardising them raw lets the right tail own the
variance, so low-magnitude traffic collapses into one dense blob the Isolation
Forest cannot isolate -- and quiet attacks such as a slow port scan live exactly
there. These pin the log-scaling that fixes it.

Run: python tests/test_anomaly.py   (or pytest tests/)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np

from ml.models.anomaly import AnomalyDetector

RNG = np.random.default_rng(5)


def _lognormal(shift, scale, n=800, d=6):
    """Traffic shaped like real flow features: exponential spread over orders."""
    return np.exp(RNG.normal(shift, scale, size=(n, d))) * 100


def _fitted(benign):
    det = AnomalyDetector(n_estimators=120, max_samples=min(4000, len(benign)),
                          random_state=5)
    det.fit(benign)
    det.calibrate(benign, flag_rate=0.01)
    return det


def test_quiet_traffic_is_separated_from_benign():
    """The regression this fix exists for.

    A low-magnitude family sat at the 51st percentile of benign -- the middle of
    normal -- so no flag rate could recover it. It must now sit near the top.
    """
    benign = _lognormal(0.0, 1.0)
    quiet = _lognormal(-1.8, 0.8, n=300)          # PortScan-shaped

    det = _fitted(benign)
    b = np.sort(det.score(benign))
    pct = np.searchsorted(b, np.median(det.score(quiet))) / len(b)

    assert pct > 0.90, (
        f"quiet traffic sits at the {pct:.0%} percentile of benign; "
        "the detector cannot tell it apart")


def test_quiet_traffic_is_caught_at_the_budgeted_flag_rate():
    benign = _lognormal(0.0, 1.0)
    quiet = _lognormal(-1.8, 0.8, n=300)

    det = _fitted(benign)
    recall = det.is_anomalous(det.score(quiet)).mean()
    # Raw features score 0% here, so the bar only has to be clear of the floor;
    # setting it near the observed value would make the test brittle to the
    # fixture size rather than to the behaviour it is guarding.
    assert recall > 0.5, f"only {recall:.1%} of quiet traffic caught at a 1% flag rate"


def test_loud_traffic_still_caught():
    """The fix must not trade one tail for the other."""
    benign = _lognormal(0.0, 1.0)
    loud = _lognormal(3.4, 1.6, n=300)            # Infiltration-shaped

    det = _fitted(benign)
    recall = det.is_anomalous(det.score(loud)).mean()
    assert recall > 0.8, f"only {recall:.1%} of loud traffic caught"


def test_benign_flag_rate_is_honoured():
    benign = _lognormal(0.0, 1.0)
    det = _fitted(benign)
    rate = det.is_anomalous(det.score(benign)).mean()
    assert rate < 0.05, f"{rate:.1%} of benign flagged, budget was 1%"


def test_negative_features_stay_finite():
    """Some CICIDS releases carry negative values in a few columns."""
    benign = _lognormal(0.0, 1.0)
    benign[:, 0] *= -1
    det = _fitted(benign)
    s = det.score(benign)
    assert np.isfinite(s).all(), "negative feature produced a non-finite score"


def test_a_detector_pickled_before_log_scaling_keeps_its_old_behaviour():
    """Scoring an old artefact through the new transform would mismatch the scaler
    it was fitted with, and silently corrupt every score it produced."""
    benign = _lognormal(0.0, 1.0)
    det = _fitted(benign)

    raw_equivalent = AnomalyDetector(n_estimators=120, max_samples=len(benign), random_state=5)
    raw_equivalent.log_features = False
    raw_equivalent.fit(benign)

    del raw_equivalent.log_features          # as an old pickle would arrive
    assert np.allclose(raw_equivalent._prep(benign), benign), (
        "an old detector must not have the transform applied retroactively")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        t()
    print(f"anomaly detector tests passed ({len(TESTS)} cases)")
