import numpy as np
import pytest

from ml.explain import Explainer

FEATURES = ["a", "b", "c", "d"]


class FakeShap:
    """Returns a fixed attribution in one of shap's multiclass layouts."""

    def __init__(self, per_feature, layout, classes=3):
        self.per_feature = np.asarray(per_feature, dtype="float64")
        self.layout, self.classes = layout, classes

    def shap_values(self, X):
        n = len(X)
        # (n, f, classes): the attribution sits in class 1, the other classes are small noise
        v = np.full((n, len(FEATURES), self.classes), 0.01)
        v[:, :, 1] = self.per_feature
        if self.layout == "rows_features_classes":
            return v
        if self.layout == "list_per_class":
            return [v[:, :, c] for c in range(self.classes)]
        if self.layout == "classes_rows_features":
            return np.transpose(v, (2, 0, 1))
        raise AssertionError(self.layout)


def explainer(fake):
    e = Explainer(model=None, features=FEATURES, benign_mean=[0] * 4, benign_std=[1] * 4)
    e.shap = fake
    return e


@pytest.mark.parametrize("layout", ["rows_features_classes", "list_per_class",
                                    "classes_rows_features"])
def test_top_names_the_features_that_drove_the_score(layout):
    # "d" matters most, then "b"; the old reshape named "a"/"b" for the new layout
    e = explainer(FakeShap([0.1, 0.5, 0.0, -0.9], layout))
    top = e.top(np.array([1.0, 2.0, 3.0, 4.0]), k=2)
    assert [t["feature"] for t in top] == ["d", "b"]
    assert top[0]["value"] == 4.0
    assert top[0]["impact"] == pytest.approx(0.9)


def test_batch_matches_one_row_at_a_time():
    e = explainer(FakeShap([0.3, 0.2, 0.7, 0.1], "rows_features_classes"))
    X = np.arange(12, dtype="float64").reshape(3, 4)
    assert e.top_batch(X) == [e.top(x) for x in X]
    assert e.top_batch(np.empty((0, 4))) == []


def test_falls_back_to_z_scores_without_shap():
    e = Explainer(model=None, features=FEATURES, benign_mean=[0, 0, 0, 0],
                  benign_std=[1, 1, 0, 2])
    e.shap = None
    top = e.top(np.array([1.0, -5.0, 2.0, 8.0]))
    assert [t["feature"] for t in top] == ["b", "d", "c"]   # 5, 4, 2 (zero std treated as 1)
