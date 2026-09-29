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
