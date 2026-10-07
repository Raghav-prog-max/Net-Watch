"""Leakage-free splitting.

Flows from one attack burst are near-duplicates. Splitting them at random puts
copies of the same burst in train and test, which inflates every metric. We group
flows into short time blocks and split whole blocks instead.

Each attack family sits in a handful of blocks (CICIDS2017: DDoS 5 of 398,
PortScan 12), so blocks are divided within each family. Divided across all
families at once, DDoS's 5 landed in train and val and none in test, where it
then scored F1 = 0.

Within a family the blocks go in time order: the earliest train, the next
validate, the latest test, and one block is dropped at each boundary. An attack
runs for 20-60 minutes, longer than a block, so blocks shuffled at random put
neighbouring minutes of the same session in train and test; ordered and purged,
the model is tested on a later stretch it has not seen, at least one block after
anything it trained on. A family with several tools (DoS: Hulk, GoldenEye, ...)
is tested on its later tools.
"""
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


def _allocate(n_blocks, share, purge):
    """(train, val, test, purge) block counts for a stratum of n_blocks in time
    order, laid out train | purge | val | purge | test. Too few blocks to purge
    both boundaries: val goes first (5 blocks still fit 1+1+1+1+1); two blocks:
    train and test touch, as there is nothing to drop."""
    n_val, n_test = _held_out(n_blocks, share)

    def n_train(v, t, p):
        return n_blocks - v - t - (p if v else 0) - (p if t else 0)

    if n_val and n_train(n_val, n_test, purge) < 1:
        n_val = 0
    if n_test and n_train(n_val, n_test, purge) < 1:
        purge = 0
    return n_train(n_val, n_test, purge), n_val, n_test, purge


def _in_time_order(df, blocks):
    """`blocks` sorted by their first flow (by row order without timestamps)."""
    if "Timestamp" in df.columns and df["Timestamp"].notna().any():
        first = df.groupby("block")["Timestamp"].min()
    else:
        first = df.reset_index().groupby("block")["index"].min()
    return sorted(blocks, key=lambda b: (first[b], b))


def _drop_near(part, held_out, minutes):
    """`part` without its attack flows that come within `minutes` of a held-out
    flow of the same family. A block is split under its rarest family, so where
    two attacks overlap, the other's flows follow that family's layout and can
    sit next to their own held-out flows; this removes them."""
    near = pd.Series(False, index=part.index)
    window = pd.Timedelta(minutes=minutes)
    for family in held_out["family"].unique():
        if family == "Benign":
            continue
        marks = held_out.loc[held_out["family"] == family, "Timestamp"].sort_values().to_numpy()
        mine = part["family"] == family
        stamps = part.loc[mine, "Timestamp"].to_numpy()
        i = marks.searchsorted(stamps)
        before = marks[(i - 1).clip(0, len(marks) - 1)]
        after = marks[i.clip(0, len(marks) - 1)]
        gap = pd.Series(stamps - before).abs().combine(pd.Series(after - stamps).abs(), min)
        near[mine] = (gap < window).to_numpy()
    return part[~near]


def make_splits(df, test_size=0.30, purge_minutes=5):
    """Returns (train, val, test). No time block appears in more than one, and
    every family found in 3 or more blocks has blocks in train and test (5 or
    more: val too). A 2-block family is tested on its later block and keeps in
    train only the flows of the earlier one at least `purge_minutes` away.

    Within each stratum (block_strata), blocks are put in time order and laid out
    train | purge | val | purge | test, val and test test_size / 2 of them each;
    the flows of purged blocks are in no split. Then no attack flow in train or
    val is left within `purge_minutes` of a later split's flow of its family
    (needs timestamps; 0 turns purging off)."""
    strata = block_strata(df)
    side = {}
    gap_blocks = 1 if purge_minutes else 0
    for family in sorted(strata.unique()):
        blocks = _in_time_order(df, strata.index[strata == family])
        n_train, n_val, n_test, purge = _allocate(len(blocks), test_size / 2, gap_blocks)
        layout = (["train"] * n_train + ["purge"] * (purge if n_val else 0) + ["val"] * n_val
                  + ["purge"] * (purge if n_test else 0) + ["test"] * n_test)
        side.update(zip(blocks, layout))
    where = df["block"].map(side)
    train, val, test = (df[where == name] for name in ("train", "val", "test"))
    if purge_minutes and "Timestamp" in df.columns and df["Timestamp"].notna().any():
        val = _drop_near(val, test, purge_minutes)
        train = _drop_near(train, pd.concat([val, test]), purge_minutes)
    return tuple(d.reset_index(drop=True) for d in (train, val, test))


def split_out_novel(df, train, val, trained_families):
    """Returns (train, val, novel): train and val without the families the
    classifier never trains on, and every flow of those families in `df`, the
    data make_splits divided. They are test material only, so taking just the
    share that the time-block split put in test threw most of them away, and
    taking them from the splits lost the ones in purged blocks."""
    def known(d):
        return d["family"].isin(trained_families)
    return train[known(train)], val[known(val)], df[~known(df)].reset_index(drop=True)


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
