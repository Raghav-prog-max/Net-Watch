"""The build fails if one time block lands in two splits.

Run: python tests/test_split_leakage.py   (or pytest tests/)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd

from ml.data.split import add_blocks, block_strata, make_splits, split_out_novel


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


def _with_novel():
    """A rare never-trained family spread across the day, one flow in 40."""
    df = _frame()
    df.loc[df.index % 40 == 0, "family"] = "Infiltration"
    return add_blocks(df, block_minutes=5)


def test_every_never_trained_flow_is_evaluated():
    """Only the share of Infiltration and Heartbleed that the split put in test
    was scored, about 15%: on CICIDS2017, 2 flows of 47."""
    df = _with_novel()
    train, val, test = make_splits(df)
    train, val, novel = split_out_novel(df, train, val, ["Benign"])
    assert len(novel) == (df["family"] == "Infiltration").sum() == 100
    assert sorted(novel["value"]) == sorted(df.loc[df["family"] == "Infiltration", "value"])
    assert (test["family"] == "Infiltration").sum() < len(novel), "most were outside test"


def test_never_trained_flows_leave_train_and_val_and_nothing_else_moves():
    df = _with_novel()
    train0, val0, test0 = make_splits(df)
    train, val, _ = split_out_novel(df, train0, val0, ["Benign"])
    assert not train["family"].eq("Infiltration").any()
    assert not val["family"].eq("Infiltration").any()
    pd.testing.assert_frame_equal(train, train0[train0["family"] == "Benign"])
    pd.testing.assert_frame_equal(val, val0[val0["family"] == "Benign"])


def _bursts():
    """400 five-minute blocks of benign traffic, 30 flows each, with attack
    bursts in a few consecutive blocks, like CICIDS2017: DDoS 5, PortScan 12.
    A third of a burst block's flows are the attack."""
    n = 400 * 30
    df = pd.DataFrame({"Timestamp": pd.date_range("2017-07-07 00:00", periods=n, freq="10s"),
                       "day": "Friday", "value": range(n), "family": "Benign"})
    df = add_blocks(df, block_minutes=5)
    position = df.index // 30
    for family, start, length in (("DDoS", 100, 5), ("PortScan", 200, 12),
                                  ("Bot", 300, 2), ("Rare", 350, 1)):
        burst = (position >= start) & (position < start + length) & (df.index % 3 == 0)
        df.loc[burst, "family"] = family
    return df


def test_a_burst_family_has_blocks_in_every_split():
    """DDoS, 5 consecutive blocks of 398, landed in train and val only: F1 = 0
    on test, and macro-F1 0.73 instead of about 0.85."""
    train, val, test = make_splits(_bursts())
    for family in ("DDoS", "PortScan"):
        for name, part in (("train", train), ("val", val), ("test", test)):
            assert part["family"].eq(family).any(), f"no {family} in {name}"


def test_a_session_is_trained_early_and_tested_late_with_a_gap():
    """Blocks shuffled within a family put neighbouring minutes of one attack
    session in train and test. Ordered and purged, everything held out comes at
    least one block after the last flow trained on."""
    train, val, test = make_splits(_bursts())
    for family in ("DDoS", "PortScan"):
        last_train = train.loc[train["family"] == family, "Timestamp"].max()
        last_val = val.loc[val["family"] == family, "Timestamp"].max()
        first_val = val.loc[val["family"] == family, "Timestamp"].min()
        first_test = test.loc[test["family"] == family, "Timestamp"].min()
        assert first_val - last_train > pd.Timedelta(minutes=5), family
        assert first_test - last_val > pd.Timedelta(minutes=5), family


def test_small_families_drop_val_before_the_gap():
    """4 blocks cannot hold train, gap, val, gap, test: val goes, the gap stays.
    2 blocks: train and test, with nothing to drop between them."""
    df = _bursts()
    position = df.index // 30
    burst = (position >= 50) & (position < 54) & (df.index % 3 == 0)
    df.loc[burst, "family"] = "Quad"
    train, val, test = make_splits(df)
    assert not val["family"].eq("Quad").any()
    gap = (test.loc[test["family"] == "Quad", "Timestamp"].min()
           - train.loc[train["family"] == "Quad", "Timestamp"].max())
    assert gap > pd.Timedelta(minutes=5)


def _nearest_minutes(part, held_out, family):
    a = part.loc[part["family"] == family, "Timestamp"]
    b = held_out.loc[held_out["family"] == family, "Timestamp"]
    return min(abs(x - y) for x in a for y in b) / pd.Timedelta(minutes=1)


def test_a_two_block_family_is_tested_and_a_one_block_family_trained():
    """Bot fills two blocks: the later is tested, and train keeps only the
    earlier block's flows 5 or more minutes before it. Rare fills one: train."""
    train, val, test = make_splits(_bursts())
    assert test["family"].eq("Bot").any() and not val["family"].eq("Bot").any()
    if train["family"].eq("Bot").any():
        assert _nearest_minutes(train, test, "Bot") >= 5
    assert train["family"].eq("Rare").any()
    assert not (val["family"].eq("Rare").any() or test["family"].eq("Rare").any())


def _overlapping():
    """DDoS in blocks 100-104, and a rarer family, one flow a block, in 102-106.
    Blocks 102-104 are split under the rarer family, so their DDoS flows follow
    its layout (102 train) while DDoS's own 100-101 go train, test: DDoS trained
    in 102 sits right after DDoS tested in 101."""
    df = _bursts()
    position = df.index // 30
    df.loc[(position >= 102) & (position < 107) & (df.index % 30 == 1), "family"] = "Sparse"
    return df


def test_overlapping_sessions_leak_without_purging():
    train, val, test = make_splits(_overlapping(), 0.30, purge_minutes=0)
    assert _nearest_minutes(train, pd.concat([val, test]), "DDoS") < 5


def test_overlapping_sessions_leave_no_neighbour_in_train():
    train, val, test = make_splits(_overlapping())
    assert train["family"].eq("DDoS").any() and test["family"].eq("DDoS").any()
    assert _nearest_minutes(train, pd.concat([val, test]), "DDoS") >= 5


def test_stratifying_keeps_blocks_whole_and_the_usual_proportions():
    df = _bursts()
    train, val, test = make_splits(df)
    a, b, c = set(train["block"]), set(val["block"]), set(test["block"])
    assert not (a & b or a & c or b & c)
    # each family drops one block before val and one before test (Bot: none, Rare: none)
    purged = df["block"].nunique() - len(a | b | c)
    assert purged == 2 + 2 + 2 + 0 + 0
    # the kept blocks' flows, less Bot's trained flows within 5 minutes of its test block
    kept = df[df["block"].isin(a | b | c)]
    missing = kept[~kept["value"].isin(pd.concat([train, val, test])["value"])]
    assert len(missing) and missing["family"].eq("Bot").all()
    assert 0.13 < len(c) / 400 < 0.17 and 0.13 < len(b) / 400 < 0.17


def test_no_purge_keeps_every_block():
    df = _bursts()
    train, val, test = make_splits(df, 0.30, purge_minutes=0)
    assert sum(map(len, (train, val, test))) == len(df)


def test_same_data_same_split():
    df = _bursts()
    for x, y in zip(make_splits(df), make_splits(df)):
        pd.testing.assert_frame_equal(x, y)


def test_a_block_is_split_under_its_rarest_attack_family():
    df = add_blocks(_frame(), block_minutes=5)
    first = df["block"].iloc[0]
    rows = df.index[df["block"] == first]
    df.loc[rows[:50], "family"] = "DoS"
    df.loc[rows[50:52], "family"] = "WebAttack"
    strata = block_strata(df)
    assert strata[first] == "WebAttack"
    assert (strata.drop(first) == "Benign").all()


if __name__ == "__main__":
    test_no_block_in_two_splits()
    test_splits_are_non_empty()
    test_every_never_trained_flow_is_evaluated()
    test_never_trained_flows_leave_train_and_val_and_nothing_else_moves()
    test_a_burst_family_has_blocks_in_every_split()
    test_a_session_is_trained_early_and_tested_late_with_a_gap()
    test_small_families_drop_val_before_the_gap()
    test_a_two_block_family_is_tested_and_a_one_block_family_trained()
    test_overlapping_sessions_leak_without_purging()
    test_overlapping_sessions_leave_no_neighbour_in_train()
    test_stratifying_keeps_blocks_whole_and_the_usual_proportions()
    test_no_purge_keeps_every_block()
    test_same_data_same_split()
    test_a_block_is_split_under_its_rarest_attack_family()
    print("split leakage tests passed")
