"""The same model scored on a random split, beside the honest one.

Flows inside one attack burst are near-duplicates. A random row split puts copies
of the same burst in train and test, so the model is graded on flows it has
effectively seen, and the score goes up. This runs the identical pipeline --
same classifier and settings, same benign downsampling, same threshold rule --
with only the split changed, so the difference is the inflation, nothing else.

It is for comparison only. Nothing here is used to pick a model or a threshold.
"""
import numpy as np
from sklearn.model_selection import train_test_split

from ml.data.split import downsample_benign
from ml.evaluate import metrics
from ml.evaluate.thresholds import pick_threshold
from ml.features.select import matrix
from ml.models import classifier as clf_mod


def random_splits(df, test_size=0.30, random_state=42):
    """(train, val, test) with the proportions make_splits uses, but by row, at
    random, ignoring time blocks: what a plain train_test_split does."""
    strat = df["family"] if df["family"].value_counts().min() >= 4 else None
    train, rest = train_test_split(df, test_size=test_size, random_state=random_state,
                                   shuffle=True, stratify=strat)
    strat = rest["family"] if strat is not None and rest["family"].value_counts().min() >= 2 else None
    val, test = train_test_split(rest, test_size=0.50, random_state=random_state,
                                 shuffle=True, stratify=strat)
    return (train.reset_index(drop=True), val.reset_index(drop=True),
            test.reset_index(drop=True))


def blocks_shared(train, test):
    """Share of test flows whose time block also appears in training: the
    leakage itself. make_splits guarantees 0."""
    if "block" not in train.columns or len(test) == 0:
        return None
    return round(float(test["block"].isin(set(train["block"])).mean()), 4)


def run(df, features, cfg, honest_main, extra_seeds=4):
    """df: every flow of a trained family, with a `block` column (add_blocks).
    honest_main: report["main"] from the time-block run, for the side-by-side.

    Also re-runs the random split with `extra_seeds` more seeds. One split is one
    draw; `inflated` is only claimed when every random split beats the honest
    score, not when one lucky draw does."""
    rs = cfg["split"]["random_state"]
    out = _run_once(df, features, cfg, rs)
    f1s = [out["macro_f1"]] + [_run_once(df, features, cfg, rs + i)["macro_f1"]
                               for i in range(1, extra_seeds + 1)]
    out.update({
        "macro_f1_over_seeds": {"seeds": len(f1s), "min": min(f1s), "max": max(f1s),
                                "mean": round(float(np.mean(f1s)), 4)},
        "honest_macro_f1": honest_main["macro_f1"],
        "honest_false_alerts_per_10k": honest_main["false_alerts_per_10k_benign_flows"],
        # positive = the random split flatters the model by this much
        "macro_f1_gap": round(out["macro_f1"] - honest_main["macro_f1"], 4),
        # every random split beats the honest one: the leak flatters the model.
        # False means no inflation was measured on this data.
        "inflated": bool(min(f1s) > honest_main["macro_f1"]),
    })
    return out


def _run_once(df, features, cfg, rs):
    train, val, test = random_splits(df, cfg["split"]["test_size"], rs)
    train = downsample_benign(train, cfg["train"]["benign_downsample"], rs)

    kind, model = clf_mod.build(cfg["train"]["classifier"], rs)
    model.fit(matrix(train, features), train["family"])

    val_score, _ = clf_mod.attack_score(model, matrix(val, features))
    thr = pick_threshold(val["family"] != "Benign", val_score, cfg["train"]["fpr_budget"])

    X = matrix(test, features)
    proba = model.predict_proba(X)
    score, _ = clf_mod.attack_score(model, X)
    fam, _ = clf_mod.predicted_family(model, proba)
    alerted = score >= thr["threshold"]
    naive = metrics.summarise(test["family"], np.where(alerted, fam, "Benign"),
                              alerted, proba, model.classes_)

    return {
        "split": "random rows (train_test_split, shuffled, stratified by family)",
        "classifier": kind,
        "rows": {"train": len(train), "val": len(val), "test": len(test)},
        "threshold": round(float(thr["threshold"]), 4),
        "macro_f1": naive["macro_f1"],
        "false_alerts_per_10k": naive["false_alerts_per_10k_benign_flows"],
        "per_class_f1": {k: v["f1-score"] for k, v in naive["per_class"].items()},
        "test_flows_from_blocks_seen_in_training": blocks_shared(train, test),
    }
