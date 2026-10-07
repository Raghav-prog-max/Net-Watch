"""The evaluation report carries what the dashboard draws (handbook: PR and ROC curves)."""
import numpy as np

from ml.evaluate import metrics


def test_summary_has_thinned_pr_and_roc_curves_per_class():
    rng = np.random.default_rng(0)
    classes = ["Benign", "DoS", "PortScan"]
    y = rng.choice(classes, size=600)
    proba = rng.dirichlet([1, 1, 1], size=600)
    for i, c in enumerate(classes):                       # make it a bit informative
        proba[y == c, i] += 0.5
    proba /= proba.sum(axis=1, keepdims=True)
    pred = np.array(classes)[proba.argmax(axis=1)]
    out = metrics.summarise(y, pred, pred != "Benign", proba, classes)
    assert set(out["curves"]) == set(classes)
    for c in classes:
        for name in ("pr", "roc"):
            pts = np.array(out["curves"][c][name])
            assert 2 <= len(pts) <= 50
            assert ((pts >= 0) & (pts <= 1)).all()
        roc = np.array(out["curves"][c]["roc"])
        assert (np.diff(roc[:, 0]) >= 0).all()             # fpr is non-decreasing
        pr = np.array(out["curves"][c]["pr"])
        assert (np.diff(pr[:, 0]) >= 0).all()              # recall sorted for drawing


# ── support: the flows behind a rate on unseen attacks ─────────────────────────
from ml.evaluate.metrics import support


def test_support_of_a_perfect_score_on_few_flows_is_wide():
    # 11 of 11 (CICIDS2017's Heartbleed): Wilson's lower bound is 1 / (1 + z^2/n)
    s = support(11, 11)
    assert (s["hits"], s["of"]) == (11, 11)
    assert s["interval_95"] == [round(1 / (1 + 1.96 ** 2 / 11), 4), 1.0]


def test_support_of_zero_stays_at_or_above_zero():
    # 0 of 36: p - 1.96 se would be 0 with zero width; Wilson gives a real upper bound
    lo, hi = support(0, 36)["interval_95"]
    assert lo == 0.0
    assert hi == round((1.96 ** 2 / 36) / (1 + 1.96 ** 2 / 36), 4)


def test_support_narrows_with_more_flows():
    small, large = support(5, 10)["interval_95"], support(500, 1000)["interval_95"]
    assert small[0] < large[0] < 0.5 < large[1] < small[1]
    assert large == [0.4691, 0.5309]


def test_support_of_no_flows_has_no_interval():
    assert support(0, 0) == {"hits": 0, "of": 0, "interval_95": None}
