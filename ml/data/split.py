"""Leakage-free splitting.

Flows from one attack burst are near-duplicates. Splitting them at random puts
copies of the same burst in train and test, which inflates every metric. We group
flows into short time blocks and split whole blocks instead.

Each attack family sits in a handful of blocks (CICIDS2017: DDoS 5 of 398,
PortScan 12), so blocks are shuffled and divided within each family. Shuffling
them all together put DDoS's 5 in train and val and none in test, where it then
scored F1 = 0.
"""
import numpy as np
import pandas as pd


def add_blocks(df: pd.DataFrame, block_minutes: int = 5) -> pd.DataFrame:
    df = df.copy()
    if "Timestamp" in df.columns and df["Timestamp"].notna().any():
        stamp = df["Timestamp"].dt.floor(f"{block_minutes}min").astype(str)
    else:  # fall back to row order when timestamps are missing
        stamp = (df.index // 1000).astype(str)
    day = df["day"].astype(str) if "day" in df.columns else "all"
    df["block"] = day + "_" + stamp
    return df


def block_strata(df: pd.DataFrame) -> pd.Series:
    """The family each time block is split under, indexed by block: the rarest
    attack family among its flows (fewest flows in `df`), or Benign if it has
    none. Without a family column every block is in one stratum."""
    blocks = pd.Index(df["block"].unique(), name="block")
    if "family" not in df.columns:
        return pd.Series("all", index=blocks)
    flows = df["family"].value_counts()
    attacks = df.loc[df["family"] != "Benign", ["block", "family"]].drop_duplicates()
    rarest = (attacks.assign(flows=attacks["family"].map(flows))
              .sort_values(["flows", "family"])
              .drop_duplicates("block")
              .set_index("block")["family"])
    return rarest.reindex(blocks).fillna("Benign")


def _held_out(n_blocks, share):
    """(val, test) block counts for a stratum of n_blocks: `share` each, but at
    least one each while train keeps one. Two blocks: one trains, one tests."""
    if n_blocks >= 3:
        k = min(max(1, int(n_blocks * share + 0.5)), (n_blocks - 1) // 2)
        return k, k
    return (0, 1) if n_blocks == 2 else (0, 0)


def make_splits(df, test_size=0.30, random_state=42):
    """Returns (train, val, test). No time block appears in more than one, and
    every family found in 3 or more blocks has blocks in all three (2 blocks:
    train and test).

    Within each stratum (block_strata), blocks are shuffled and test_size of
    them divided equally between val and test."""
    strata = block_strata(df)
    rng = np.random.RandomState(random_state)
    side = {}
    for family in sorted(strata.unique()):
        blocks = sorted(strata.index[strata == family])
        blocks = [blocks[i] for i in rng.permutation(len(blocks))]
        n_val, n_test = _held_out(len(blocks), test_size / 2)
        for i, block in enumerate(blocks):
            side[block] = "val" if i < n_val else "test" if i < n_val + n_test else "train"
    where = df["block"].map(side)
    return tuple(df[where == name].reset_index(drop=True) for name in ("train", "val", "test"))


def split_out_novel(train, val, test, trained_families):
    """Returns (train, val, novel): train and val without the families the
    classifier never trains on, and every flow of those families from all three
    splits. They are test material only, so taking just the share that the
    time-block split put in test threw most of them away. `test` is unchanged."""
    def known(d):
        return d["family"].isin(trained_families)
    novel = pd.concat([d[~known(d)] for d in (train, val, test)], ignore_index=True)
    return train[known(train)], val[known(val)], novel


def lofo_split(train, val, family):
    """Remove one attack family from training and validation entirely."""
    return (train[train["family"] != family].reset_index(drop=True),
            val[val["family"] != family].reset_index(drop=True))


def downsample_benign(train, fraction, random_state=42):
    if fraction >= 1.0:
        return train
    benign = train[train["family"] == "Benign"].sample(frac=fraction, random_state=random_state)
    attacks = train[train["family"] != "Benign"]
    return pd.concat([benign, attacks]).sample(frac=1.0, random_state=random_state).reset_index(drop=True)
