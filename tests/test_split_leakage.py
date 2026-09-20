"""The build fails if one time block lands in two splits.

Run: python tests/test_split_leakage.py   (or pytest tests/)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd

from ml.data.split import add_blocks, make_splits


def _frame(n=4000):
    ts = pd.date_range("2017-07-07 08:00", periods=n, freq="s")
    return pd.DataFrame({"Timestamp": ts, "day": "Friday",
                         "value": range(n), "family": ["Benign"] * n})


def test_no_block_in_two_splits():
    df = add_blocks(_frame(), block_minutes=5)
    train, val, test = make_splits(df)
    a, b, c = set(train["block"]), set(val["block"]), set(test["block"])
    assert not (a & b), "train and val share a time block"
    assert not (a & c), "train and test share a time block"
    assert not (b & c), "val and test share a time block"


def test_splits_are_non_empty():
    df = add_blocks(_frame(), block_minutes=5)
    train, val, test = make_splits(df)
    assert len(train) and len(val) and len(test)


if __name__ == "__main__":
    test_no_block_in_two_splits()
    test_splits_are_non_empty()
    print("split leakage tests passed")
