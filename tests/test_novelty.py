"""The label a classifier hands back has to survive a sanity check.

These cover ml/models/novelty.py and the decision branches in ml/models/combine.py
that depend on it. The behaviour under test is the one that carries the project's
zero-day claim: a softmax always returns one of its trained classes, so a novel
attack arrives wearing a confident but wrong family name, and the only thing that
catches it is asking whether the flow actually resembles that family.

Run: python tests/test_novelty.py   (or pytest tests/)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np

from ml.models.novelty import FamilyNovelty
from ml.models.combine import decide

RNG = np.random.default_rng(11)
THR = 0.9869          # a realistic budget-derived attack threshold


def _family(center, n=300, spread=1.0):
    """n flows scattered around a centre, 4 features."""
    return RNG.normal(center, spread, size=(n, 4))


def _corpus():
    """Two well-separated known families."""
    ddos = _family([100.0, 20.0, 5.0, 1.0])
    scan = _family([2.0, 200.0, 50.0, 9.0])
    X = np.vstack([ddos, scan])
    fams = np.array(["DDoS"] * len(ddos) + ["PortScan"] * len(scan))
    return X, fams


# ---------------------------------------------------------------- fit

def test_fit_builds_a_profile_per_family():
    X, fams = _corpus()
    nov = FamilyNovelty().fit(X, fams)
    assert set(nov.center) == {"DDoS", "PortScan"}
    assert nov.center["DDoS"].shape == (4,)
    # the profile should land near the centre the data was generated around
    assert abs(nov.center["DDoS"][0] - 100.0) < 1.0


def test_fit_skips_a_family_with_too_few_rows():
    X = np.vstack([_family([5.0, 5.0, 5.0, 5.0], n=50), [[1.0, 1.0, 1.0, 1.0]]])
    fams = np.array(["Bot"] * 50 + ["Rare"])
    nov = FamilyNovelty().fit(X, fams)
    assert "Bot" in nov.center
    assert "Rare" not in nov.center, "a single row cannot describe a family"


def test_constant_feature_does_not_dominate():
    """A feature identical across a family says nothing about membership.

    With a zero spread it would divide by ~0 and make every flow look infinitely
    far away on that one axis, so it must be given a usable scale instead.
    """
    X = _family([10.0, 10.0, 10.0, 10.0], n=200)
    X[:, 2] = 7.0                                   # constant column
    fams = np.array(["DoS"] * len(X))
    nov = FamilyNovelty().fit(X, fams)
    assert np.isfinite(nov.scale["DoS"]).all()
    assert (nov.scale["DoS"] > 0).all()

    d = nov.distance(X, fams)
    assert np.isfinite(d).all(), "a constant feature made the distance blow up"


# ---------------------------------------------------------------- distance

def test_members_score_low_and_strangers_score_high():
    X, fams = _corpus()
    nov = FamilyNovelty().fit(X, fams)

    genuine = nov.distance(X[fams == "DDoS"], np.array(["DDoS"] * 300))
    # the same flows, but claimed to be the other family
    mislabelled = nov.distance(X[fams == "DDoS"], np.array(["PortScan"] * 300))

    assert genuine.mean() < mislabelled.mean() / 5, (
        f"members {genuine.mean():.2f} vs strangers {mislabelled.mean():.2f} "
        "-- the check cannot separate them")


def test_unknown_family_is_not_judged():
    """No profile means no opinion, not a guess."""
    X, fams = _corpus()
    nov = FamilyNovelty().fit(X, fams)
    d = nov.distance(X[:5], np.array(["NeverSeen"] * 5))
    assert (d == 0.0).all()


# ---------------------------------------------------------------- calibrate

def test_calibration_respects_the_keep_rate():
    X, fams = _corpus()
    nov = FamilyNovelty(keep_rate=0.95).fit(X, fams)
    nov.calibrate(X, fams)

    flagged = nov.is_out_of_family(nov.distance(X, fams), fams)
    rate = flagged.mean()
    # 5% of genuine flows sit above the cut-off by construction; allow slack
    assert rate <= 0.10, f"{rate:.1%} of genuine flows rejected, budget was 5%"


def test_calibration_skips_a_thin_family_and_falls_back():
    X = np.vstack([_family([50.0, 50.0, 50.0, 50.0], n=200),
                   _family([1.0, 1.0, 1.0, 1.0], n=5)])
    fams = np.array(["DoS"] * 200 + ["Thin"] * 5)
    nov = FamilyNovelty().fit(X, fams)
    nov.calibrate(X, fams)
    assert "DoS" in nov.threshold
    assert "Thin" not in nov.threshold, "5 rows is not enough to set a cut-off"
    assert np.isfinite(nov.default_threshold), "no fallback for uncalibrated families"


def test_a_novel_family_is_rejected():
    """The whole point: traffic unlike anything trained on, labelled as something."""
    X, fams = _corpus()
    nov = FamilyNovelty().fit(X, fams)
    nov.calibrate(X, fams)

    novel = _family([-400.0, -400.0, 900.0, 600.0], n=120)
    claimed = np.array(["DDoS"] * len(novel))       # what the classifier would say
    flagged = nov.is_out_of_family(nov.distance(novel, claimed), claimed)
    assert flagged.mean() > 0.9, f"only {flagged.mean():.1%} of novel flows rejected"


# ---------------------------------------------------------------- decide()

def _alert(**kw):
    args = dict(attack_score=1.0, family="DDoS", confidence=1.0, anomaly_score=0.8,
                anomaly_pct=0.9, is_anomalous=True, attack_threshold=THR,
                out_of_family=False)
    args.update(kw)
    return decide(**args)


def test_confident_in_family_flow_keeps_its_name():
    a = _alert(out_of_family=False)
    assert a["prediction"]["family"] == "DDoS"
    assert a["is_novel"] is False
    assert "rejected_label" not in a


def test_confident_out_of_family_flow_becomes_unknown():
    """The regression this module exists for.

    Before the check, a never-trained-on attack came back as a confident known
    family and is_novel never fired once across 600 flows.
    """
    a = _alert(out_of_family=True)
    assert a["prediction"]["family"] == "Unknown"
    assert a["is_novel"] is True
    assert a["rejected_label"]["family"] == "DDoS", "analyst cannot see what was rejected"
    assert a["mitre"]["tactic"] == "Unmapped"


def test_rejection_does_not_need_the_detector_to_agree():
    """Requiring both signals suppressed every rejection on Heartbleed, which the
    detector never flags at a 1% benign flag rate."""
    a = _alert(out_of_family=True, is_anomalous=False)
    assert a["prediction"]["family"] == "Unknown"
    assert a["is_novel"] is True


def test_below_threshold_but_abnormal_is_still_unknown():
    a = _alert(attack_score=0.1, is_anomalous=True)
    assert a["prediction"]["family"] == "Unknown"
    assert a["is_novel"] is True


def test_quiet_flow_raises_nothing():
    assert _alert(attack_score=0.1, is_anomalous=False, out_of_family=False) is None


def test_out_of_family_alone_cannot_manufacture_an_alert():
    """A flow the classifier does not call an attack and the detector does not find
    abnormal stays silent, whatever the distance check thinks."""
    assert _alert(attack_score=0.1, is_anomalous=False, out_of_family=True) is None


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        t()
    print(f"novelty tests passed ({len(TESTS)} cases)")
