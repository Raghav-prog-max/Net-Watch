"""Does this flow actually look like the family the classifier just named?

The classifier's softmax runs over the families it was trained on, so it always
returns one of them, with a confidence that means nothing for traffic outside
that set. An unseen attack comes back as a confident wrong label -- which is why
classifier confidence can never, on its own, tell you something is novel.

This is the missing check. For each known family we keep a robust profile of its
training flows (per-feature median and IQR). At scoring time we measure how far a
flow sits from the profile of the family it was just assigned. A flow the model
calls DDoS that looks nothing like the DDoS it learned is a flow whose label
should not be trusted, and the alert says Unknown instead.

The cut-off comes from a budget, the same as every other threshold here: the
distance below which a stated fraction of that family's own validation flows sit.
"""
import numpy as np

EPS = 1e-9


class FamilyNovelty:
    """Per-family out-of-distribution check on the classifier's own label."""

    def __init__(self, keep_rate=0.99):
        # keep_rate 0.99 -> at most ~1% of genuine flows of a family are called novel
        self.keep_rate = keep_rate
        self.center = {}      # family -> per-feature median
        self.scale = {}       # family -> per-feature IQR (robust spread)
        self.threshold = {}   # family -> distance cut-off
        self.default_threshold = np.inf

    def fit(self, X, families):
        X = np.asarray(X, dtype="float64")
        families = np.asarray(families)
        for fam in np.unique(families):
            rows = X[families == fam]
            if len(rows) < 2:
                continue
            med = np.median(rows, axis=0)
            q75, q25 = np.percentile(rows, [75, 25], axis=0)
            iqr = q75 - q25
            # a feature that is constant within a family carries no information
            # about membership; give it a wide scale so it cannot dominate
            iqr[iqr < EPS] = np.median(iqr[iqr >= EPS]) if np.any(iqr >= EPS) else 1.0
            self.center[str(fam)] = med
            self.scale[str(fam)] = iqr
        return self

    def distance(self, X, families):
        """Median absolute robust z-score against the named family's profile.

        Median rather than mean so one wild feature cannot, by itself, declare a
        flow novel -- the flow has to be broadly unlike the family.
        """
        X = np.asarray(X, dtype="float64")
        families = np.asarray(families)
        out = np.zeros(len(X), dtype="float64")
        for i in range(len(X)):
            fam = str(families[i])
            if fam not in self.center:
                out[i] = 0.0
                continue
            z = np.abs(X[i] - self.center[fam]) / (self.scale[fam] + EPS)
            out[i] = float(np.median(z))
        return out

    def calibrate(self, X, families):
        """Cut-off per family, from that family's own genuine flows."""
        d = self.distance(X, families)
        families = np.asarray(families)
        for fam in np.unique(families):
            rows = d[families == fam]
            if len(rows) < 20:
                continue
            self.threshold[str(fam)] = float(np.quantile(rows, self.keep_rate))
        if self.threshold:
            self.default_threshold = float(max(self.threshold.values()))
        return self.threshold

    def is_out_of_family(self, distances, families):
        families = np.asarray(families)
        cut = np.array([self.threshold.get(str(f), self.default_threshold) for f in families])
        return np.asarray(distances) >= cut
