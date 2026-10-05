"""The replayer sends only flows the models were not fitted on.

It sent every processed flow, training rows included, so the demo's false-alert
rate and catches were partly measured on traffic the models had already learned.

Run: pytest tests/test_replayer.py
"""
import sys
import tempfile
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import replay.replayer as replayer
from replay.replayer import pick, replay_pool


def _processed():
    """Every flow, as data/processed/flows.pkl holds them: the `split` column
    says where ml/train.py's time-block split put each one."""
    rows = []
    for split, n in (("train", 60), ("val", 20), ("test", 20)):
        for i in range(n):
            family = ["Benign", "DDoS", "PortScan", "Infiltration"][i % 4]
            rows.append({"split": split, "family": family,
                         "Timestamp": pd.Timestamp("2017-07-07 08:00") + pd.Timedelta(seconds=len(rows)),
                         "Flow Duration": float(len(rows))})
    return pd.DataFrame(rows)


def _pool(df):
    """replay_pool with replayer.TEST_SPLIT pointing at df's test rows."""
    saved = replayer.TEST_SPLIT
    with tempfile.TemporaryDirectory() as tmp:
        replayer.TEST_SPLIT = Path(tmp) / "test.pkl"
        df[df["split"] == "test"].reset_index(drop=True).to_pickle(replayer.TEST_SPLIT)
        try:
            return replay_pool(df)
        finally:
            replayer.TEST_SPLIT = saved


def test_no_training_or_validation_flow_of_a_trained_family_is_replayed():
    pool = _pool(_processed())
    trained = pool[pool["family"] != "Infiltration"]
    assert (trained["split"] == "test").all(), trained["split"].value_counts().to_dict()


def test_every_never_trained_flow_is_replayed():
    """No model is fitted on them, so all of them are held out, whatever split
    they fell in (ml/data/split.py split_out_novel)."""
    df = _processed()
    pool = _pool(df)
    assert (pool["family"] == "Infiltration").sum() == (df["family"] == "Infiltration").sum() == 25


def test_scenarios_draw_on_the_pool():
    pool = _pool(_processed())
    for scenario, families in (("normal", {"Benign"}), ("known", {"DDoS", "PortScan"})):
        out = pick(pool, scenario)
        assert set(out["family"]) == families and (out["split"] == "test").all(), scenario


def test_mixed_is_in_the_order_it_happened():
    """"everything, in timestamp order" -- it was the shuffled pool."""
    pool = _pool(_processed()).sample(frac=1.0, random_state=1)
    out = pick(pool, "mixed")
    assert out["Timestamp"].is_monotonic_increasing
    assert len(out) == len(pool)


def test_without_a_test_split_it_says_so_and_replays_everything(capsys):
    df = _processed()
    saved = replayer.TEST_SPLIT
    with tempfile.TemporaryDirectory() as tmp:
        replayer.TEST_SPLIT = Path(tmp) / "missing.pkl"
        try:
            pool = replay_pool(df)
        finally:
            replayer.TEST_SPLIT = saved
    assert len(pool) == len(df)
    assert "training ones included" in capsys.readouterr().out
