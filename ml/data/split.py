"""Leakage-free splitting.

Flows from one attack burst are near-duplicates. Splitting them at random puts
copies of the same burst in train and test, which inflates every metric. We group
flows into short time blocks and split whole blocks instead.

Each attack family sits in a handful of blocks (CICIDS2017: DDoS 5 of 398,
PortScan 12), so blocks are shuffled and divided within each family. 

To prevent covariate shift where all morning background traffic ends up in train
and evening traffic ends up in test, blocks are further stratified by day and 
time-bin (morning, midday, afternoon, evening).
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


def _hour_bin(hour):
    if hour < 10: return "morning"
    if hour < 13: return "midday"
    if hour < 17: return "afternoon"
    return "evening"


def _assign_time_bins(df: pd.DataFrame) -> pd.Series:
    """Assigns morning/midday/afternoon/evening proxy bins.
    Uses Timestamp if available, otherwise divides each day's rows into quartiles."""
    has_ts = "Timestamp" in df.columns and df["Timestamp"].notna().any()
    if has_ts:
        return df["Timestamp"].dt.hour.apply(_hour_bin)
    
    # Fallback: sequential row quartiles per day
    bins = []
    if "day" in df.columns:
        for day in df["day"].unique():
            mask = df["day"] == day
            n = mask.sum()
            q = np.array(["morning"] * n)
            q[n//4 : 2*n//4] = "midday"
            q[2*n//4 : 3*n//4] = "afternoon"
            q[3*n//4 :] = "evening"
            bins.append(pd.Series(q, index=df.index[mask]))
        return pd.concat(bins)
    else:
        n = len(df)
        q = np.array(["morning"] * n)
        q[n//4 : 2*n//4] = "midday"
        q[2*n//4 : 3*n//4] = "afternoon"
        q[3*n//4 :] = "evening"
        return pd.Series(q, index=df.index)


def make_splits(df, test_size=0.30, random_state=42):
    """Returns (train, val, test). No time block appears in more than one.
    
    Blocks are stratified by (family, day, time_bin) to ensure each family
    is split, AND the background traffic's daily cycle is distributed evenly
    across train, val, and test to prevent covariate shift."""
    df = df.copy()
    if "time_bin" not in df.columns:
        df["time_bin"] = _assign_time_bins(df)
        
    block_info = df.groupby("block").agg(
        day=("day", "first") if "day" in df.columns else ("block", lambda _: "all"),
        time_bin=("time_bin", lambda x: x.mode()[0])
    )
    
    block_info["family_stratum"] = block_strata(df)
    block_info["split_key"] = (block_info["family_stratum"] + "|" +
                               block_info["day"].astype(str) + "|" +
                               block_info["time_bin"])
    
    rng = np.random.RandomState(random_state)
    assignment = {}
    
    for key, group in block_info.groupby("split_key"):
        blocks = sorted(group.index.tolist())
        blocks = [blocks[i] for i in rng.permutation(len(blocks))]
        n = len(blocks)
        
        if n >= 3:
            n_held = min(max(1, int(n * test_size / 2 + 0.5)), (n - 1) // 2)
            for i, b in enumerate(blocks):
                if i < n_held: assignment[b] = "val"
                elif i < 2 * n_held: assignment[b] = "test"
                else: assignment[b] = "train"
        elif n == 2:
            assignment[blocks[0]] = "train"
            assignment[blocks[1]] = "test"
        else:
            assignment[blocks[0]] = "train"
            
    # Rescue operation for highly clustered attacks: if an attack family has 
    # blocks, but they all landed in train due to isolated time-bins, move 
    # one to test so the model can be evaluated on it.
    for fam in block_info["family_stratum"].unique():
        if fam == "Benign" or fam == "all":
            continue
        fam_blocks = block_info[block_info["family_stratum"] == fam].index
        in_test = [b for b in fam_blocks if assignment.get(b) == "test"]
        if not in_test:
            in_train = [b for b in fam_blocks if assignment.get(b) == "train"]
            if in_train:
                assignment[in_train[-1]] = "test"
                
    where = df["block"].map(assignment).fillna("train")
    return tuple(df[where == name].drop(columns=["time_bin"], errors="ignore").reset_index(drop=True) 
                 for name in ("train", "val", "test"))


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
