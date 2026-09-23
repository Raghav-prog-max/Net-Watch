"""End-to-end training. One command rebuilds every number the deck reports.

    python -m ml.train --config ml/config.yaml
"""
import argparse, json, time
from pathlib import Path

import joblib
import numpy as np
import yaml

from ml.data.labels import TRAIN_FAMILIES, LOFO_FAMILIES
from ml.data.load import load_processed
from ml.data.split import add_blocks, make_splits, downsample_benign
from ml.drift.monitor import reference_stats
from ml.evaluate import lofo, metrics
from ml.evaluate.thresholds import pick_threshold
from ml.features.select import feature_columns, matrix
from ml.models import classifier as clf_mod
from ml.models.anomaly import AnomalyDetector
from ml.models.novelty import FamilyNovelty

def _run_imbalance_study(train_df, val_df, features, random_state=42):
    from sklearn.metrics import f1_score
    from imblearn.over_sampling import SMOTE
    from imblearn.under_sampling import RandomUnderSampler
    import lightgbm as lgb
    import json
    
    print("\n============================================================")
    print("  Imbalance strategy comparison")
    print("============================================================\n")

    X_train = matrix(train_df, features)
    X_val = matrix(val_df, features)
    
    # We need string labels for f1_score to handle families properly
    y_train_str = train_df["family"].values
    y_val_str = val_df["family"].values
    
    strategies = []
    strategies.append(("no_handling", X_train, y_train_str))
    strategies.append(("class_weight", X_train, y_train_str))
    
    # Benign undersampling
    try:
        y_train_counts = train_df["family"].value_counts()
        sampling_strategy = {}
        for fam, count in y_train_counts.items():
            if fam == "Benign":
                attacks = sum(y_train_counts) - count
                sampling_strategy[fam] = min(count, int(attacks * 5))
            else:
                sampling_strategy[fam] = count
        
        rus = RandomUnderSampler(sampling_strategy=sampling_strategy, random_state=random_state)
        X_us, y_us = rus.fit_resample(X_train, y_train_str)
        strategies.append(("undersample", X_us, y_us))
    except Exception as e:
        print(f"Undersample failed: {e}")

    # SMOTE (requires numeric encoding for SMOTE, but works with strings in latest imblearn usually. If it fails we skip)
    try:
        smote = SMOTE(random_state=random_state, k_neighbors=3)
        X_sm, y_sm = smote.fit_resample(X_train, y_train_str)
        strategies.append(("smote", X_sm, y_sm))
    except Exception as e:
        print(f"SMOTE failed: {e}")

    results = []
    for name, X_tr, y_tr in strategies:
        cw = "balanced" if name == "class_weight" else None
        model = lgb.LGBMClassifier(
            n_estimators=200, learning_rate=0.05, num_leaves=31,
            class_weight=cw, n_jobs=-1, verbose=-1, random_state=random_state
        )
        model.fit(X_tr, y_tr, eval_set=[(X_val, y_val_str)],
                  callbacks=[lgb.early_stopping(20, verbose=False), lgb.log_evaluation(-1)])
        
        y_pred = model.predict(X_val)
        macro = float(f1_score(y_val_str, y_pred, average="macro", zero_division=0))
        results.append({"strategy": name, "macro_f1": round(macro, 4)})
        print(f"  {name:20s}  macro-F1={macro:.4f}")

    out = Path("reports/model_comparison.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as fh:
        json.dump(results, fh, indent=2)
    print(f"Imbalance study saved to {out}")


def main(config_path, skip_lofo=False, holdout=None, imbalance_study=False):
    cfg = yaml.safe_load(open(config_path))
    started = time.time()

    df = load_processed(cfg["paths"]["processed"])
    df = df[df["family"].isin(TRAIN_FAMILIES + ["Infiltration", "Heartbleed"])]
    df = add_blocks(df, cfg["split"]["block_minutes"])

    train, val, test = make_splits(df, cfg["split"]["test_size"], cfg["split"]["random_state"])
    features = feature_columns(train)

    # Rare families are never trained on. They exist to test the anomaly detector.
    novel_mask = ~train["family"].isin(TRAIN_FAMILIES)
    train = train[~novel_mask]
    val = val[val["family"].isin(TRAIN_FAMILIES)]
    if holdout:
        # Demo model: this family is removed from training so the anomaly detector
        # has to catch it. This is what makes "Unknown / novel" appear on stage.
        train = train[train["family"] != holdout]
        val = val[val["family"] != holdout]
        skip_lofo = True
    train = downsample_benign(train, cfg["train"]["benign_downsample"],
                              cfg["split"]["random_state"])

    print(f"train {len(train):,} | val {len(val):,} | test {len(test):,} | features {len(features)}")

    if imbalance_study:
        _run_imbalance_study(train, val, features, cfg["split"]["random_state"])

    # --- classifier -------------------------------------------------------
    kind, model = clf_mod.build(cfg["train"]["classifier"], cfg["split"]["random_state"])
    model.fit(matrix(train, features), train["family"])
    print(f"classifier: {kind}")

    base = clf_mod.baseline(cfg["split"]["random_state"])
    base.fit(matrix(train, features), train["family"])

    # --- threshold from the false-positive budget -------------------------
    val_score, _ = clf_mod.attack_score(model, matrix(val, features))
    thr = pick_threshold(val["family"] != "Benign", val_score, cfg["train"]["fpr_budget"])
    print(f"threshold {thr['threshold']:.4f} at FPR {thr.get('fpr_at_threshold')}")

    # --- anomaly detector, benign traffic only ----------------------------
    benign_train = train[train["family"] == "Benign"]
    det = AnomalyDetector(cfg["anomaly"]["n_estimators"],
                          min(cfg["anomaly"]["max_samples"], max(len(benign_train), 1)),
                          cfg["split"]["random_state"])
    det.fit(matrix(benign_train, features))
    det.calibrate(matrix(val[val["family"] == "Benign"], features),
                  cfg["anomaly"]["benign_flag_rate"])

    # --- is the classifier's own label trustworthy? -----------------------
    # Fitted on attack flows only: "Benign" is not a family whose label we reject,
    # and the detector already covers benign traffic that looks wrong.
    attacks_train = train[train["family"] != "Benign"]
    attacks_val = val[val["family"] != "Benign"]
    nov = FamilyNovelty(cfg["anomaly"].get("family_keep_rate", 0.99))
    nov.fit(matrix(attacks_train, features), attacks_train["family"])
    nov.calibrate(matrix(attacks_val, features), attacks_val["family"])

    # --- honest evaluation on the held-out test set -----------------------
    known_test = test[test["family"].isin(TRAIN_FAMILIES)]
    Xt = matrix(known_test, features)
    proba = model.predict_proba(Xt)
    attack_score, _ = clf_mod.attack_score(model, Xt)
    fam, _ = clf_mod.predicted_family(model, proba)
    y_pred = np.where(attack_score >= thr["threshold"], fam, "Benign")

    report = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "classifier": kind,
        "features": len(features),
        "rows": {"train": len(train), "val": len(val), "test": len(test)},
        "threshold": thr,
        "main": metrics.summarise(known_test["family"], y_pred,
                                  attack_score >= thr["threshold"],
                                  proba, model.classes_),
    }

    base_proba = base.predict_proba(Xt)
    base_score, _ = clf_mod.attack_score(base, Xt)
    base_fam, _ = clf_mod.predicted_family(base, base_proba)
    report["random_forest_baseline"] = metrics.summarise(
        known_test["family"], np.where(base_score >= 0.5, base_fam, "Benign"),
        base_score >= 0.5, base_proba, base.classes_)

    # novel families the classifier never saw
    novel = test[~test["family"].isin(TRAIN_FAMILIES)]
    if len(novel):
        flagged = det.is_anomalous(det.score(matrix(novel, features)))
        Xn = matrix(novel, features)
        n_fam, _ = clf_mod.predicted_family(model, model.predict_proba(Xn))
        ood = nov.is_out_of_family(nov.distance(Xn, n_fam), n_fam)
        report["novel_families"] = {
            "families": sorted(novel["family"].unique().tolist()),
            "flows": int(len(novel)),
            "caught_by_anomaly_detector": round(float(flagged.mean()), 4),
            "label_rejected_as_out_of_family": round(float(ood.mean()), 4),
            "shown_as_unknown": round(float(ood.mean()), 4),
        }

    if not skip_lofo:
        print("running leave-one-family-out experiments...")
        report["lofo"] = lofo.run_all(train, val, test, features, LOFO_FAMILIES, cfg)

    # --- artefacts --------------------------------------------------------
    out = Path(cfg["paths"]["model_dir"])
    if holdout:
        out = out.with_name(out.name + f"-without-{holdout.lower()}")
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": features, "kind": kind}, out / "classifier.joblib")
    joblib.dump(det, out / "anomaly.joblib")
    joblib.dump(nov, out / "novelty.joblib")
    json.dump({"attack_threshold": thr["threshold"],
               "anomaly_threshold": det.threshold,
               "fpr_budget": cfg["train"]["fpr_budget"]},
              open(out / "thresholds.json", "w"), indent=2)

    bt = matrix(benign_train, features)
    # Drift is measured on the traffic the system considers benign, so the
    # reference is benign validation flows: not the downsampled training mix,
    # and not attacks, whose volume varies by the hour.
    all_train = matrix(val[val["family"] == "Benign"], features)
    json.dump({"features": features,
               "benign_mean": bt.mean(axis=0).tolist(),
               "benign_std": bt.std(axis=0).tolist(),
               "bins": reference_stats(all_train, features, cfg["drift"]["bins"])},
              open(out / "reference_stats.json", "w"))

    rep_dir = Path(cfg["paths"]["reports_dir"]); rep_dir.mkdir(parents=True, exist_ok=True)
    name = "metrics.json" if not holdout else f"metrics-without-{holdout.lower()}.json"
    json.dump(report, open(rep_dir / name, "w"), indent=2)

    print(f"macro-F1 {report['main']['macro_f1']} | "
          f"false alerts per 10k benign flows "
          f"{report['main']['false_alerts_per_10k_benign_flows']} | "
          f"{time.time() - started:.1f}s")
    print(f"wrote {out}/ and {rep_dir}/{name}")
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="ml/config.yaml")
    ap.add_argument("--skip-lofo", action="store_true")
    ap.add_argument("--holdout", default=None,
                    help="train without this family, for the novel-attack demo")
    ap.add_argument("--imbalance-study", action="store_true", help="Run the imbalance handling comparison")
    a = ap.parse_args()
    main(a.config, a.skip_lofo, a.holdout, a.imbalance_study)
