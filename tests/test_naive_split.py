"""The naive-vs-honest comparison (ml/evaluate/naive.py).

The headline case is data built to leak: every time block is a burst of
near-copies of one flow, and the label belongs to the burst, not to anything a
model could generalise. A random split must score it far higher than a
time-block split. If it did not, "no inflation" on real data would mean nothing.
"""
import numpy as np
import pandas as pd
import pytest
from sklearn.metrics import f1_score

from ml.data.split import make_splits
from ml.evaluate import naive
from ml.features.select import matrix
from ml.models import classifier as clf_mod

FEATURES = [f"f{i}" for i in range(6)]
CFG = {
    "split": {"test_size": 0.30, "random_state": 42},
    "train": {"classifier": "rf", "benign_downsample": 1.0, "fpr_budget": 0.05},
}


def bursty(n_blocks=60, per_block=40, seed=0):
    """Each block: near-duplicates of one random point, one random label."""
    rng = np.random.default_rng(seed)
    families = np.array(["Benign", "DoS", "PortScan"])
    rows = []
    for b in range(n_blocks):
        centre = rng.normal(0, 10, size=len(FEATURES))
        fam = families[b % 3]
        pts = centre + rng.normal(0, 0.01, size=(per_block, len(FEATURES)))
        for p in pts:
            rows.append({**dict(zip(FEATURES, p)), "family": fam, "block": f"b{b}"})
    return pd.DataFrame(rows)


def honest_main(df):
    train, _, test = make_splits(df, CFG["split"]["test_size"], CFG["split"]["random_state"])
    _, model = clf_mod.build("rf", 42)
    model.fit(matrix(train, FEATURES), train["family"])
    pred = model.predict(matrix(test, FEATURES))
    return {"macro_f1": round(float(f1_score(test["family"], pred, average="macro")), 4),
            "false_alerts_per_10k_benign_flows": 0.0}


def test_random_splits_are_disjoint_with_the_usual_proportions():
    df = bursty()
    df["row"] = range(len(df))
    train, val, test = naive.random_splits(df, 0.30, 42)
    ids = [set(x["row"]) for x in (train, val, test)]
    assert ids[0].isdisjoint(ids[1]) and ids[0].isdisjoint(ids[2]) and ids[1].isdisjoint(ids[2])
    assert sum(map(len, ids)) == len(df)
    assert len(train) / len(df) == pytest.approx(0.70, abs=0.01)
    assert len(test) / len(df) == pytest.approx(0.15, abs=0.01)


def test_random_split_shares_time_blocks_and_the_honest_split_does_not():
    df = bursty()
    train, _, test = naive.random_splits(df, 0.30, 42)
    assert naive.blocks_shared(train, test) > 0.9
    h_train, _, h_test = make_splits(df, 0.30, 42)
    assert naive.blocks_shared(h_train, h_test) == 0.0


def test_leaky_data_shows_a_large_gap():
    df = bursty()
    out = naive.run(df, FEATURES, CFG, honest_main(df), extra_seeds=2)
    # memorised bursts: near-perfect on a random split, chance-level on unseen blocks
    assert out["macro_f1"] > 0.95
    assert out["macro_f1_gap"] > 0.3
    assert out["inflated"] is True
    assert out["macro_f1_over_seeds"]["seeds"] == 3


def test_report_shape():
    df = bursty(n_blocks=30)
    out = naive.run(df, FEATURES, CFG, honest_main(df), extra_seeds=1)
    assert set(out) >= {"split", "rows", "threshold", "macro_f1", "false_alerts_per_10k",
                        "per_class_f1", "test_flows_from_blocks_seen_in_training",
                        "macro_f1_over_seeds", "honest_macro_f1", "honest_false_alerts_per_10k",
                        "macro_f1_gap", "inflated"}
    assert out["macro_f1_gap"] == pytest.approx(out["macro_f1"] - out["honest_macro_f1"], abs=1e-4)
