"""End-to-end training. One command rebuilds every number the deck reports.

    python -m ml.train --config ml/config.yaml
"""
import argparse, json, time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yaml

from sklearn.metrics import f1_score

from ml.data.labels import TRAIN_FAMILIES, LOFO_FAMILIES
from ml.data.load import load_processed
from ml.data.split import add_blocks, make_splits, downsample_benign
from ml.drift.monitor import reference_stats
from ml.evaluate import lofo, metrics, naive
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
    
    # We use LabelEncoder because SMOTE struggles with string labels in many versions.
    # LightGBM and f1_score handle integers perfectly.
    from sklearn.preprocessing import LabelEncoder
    le = LabelEncoder()
    le.fit(train_df["family"].values)
    y_train_enc = le.transform(train_df["family"].values)
    y_val_enc = le.transform(val_df["family"].values)
    
    strategies = []
    strategies.append(("no_handling", X_train, y_train_enc))
    strategies.append(("class_weight", X_train, y_train_enc))
    
    # Benign undersampling
    try:
        y_train_counts = train_df["family"].value_counts()
        sampling_strategy = {}
        for fam, count in y_train_counts.items():
            encoded_fam = le.transform([fam])[0]
            if fam == "Benign":
                attacks = sum(y_train_counts) - count
                sampling_strategy[encoded_fam] = min(count, int(attacks * 5))
            else:
                sampling_strategy[encoded_fam] = count
        
        rus = RandomUnderSampler(sampling_strategy=sampling_strategy, random_state=random_state)
        X_us, y_us = rus.fit_resample(X_train, y_train_enc)
        strategies.append(("undersample", X_us, y_us))
    except Exception as e:
        print(f"Undersample failed: {e}")

    # SMOTE
    smote = SMOTE(random_state=random_state, k_neighbors=3)
    X_sm, y_sm = smote.fit_resample(X_train, y_train_enc)
    strategies.append(("smote", X_sm, y_sm))

    results = []
    for name, X_tr, y_tr in strategies:
        cw = "balanced" if name == "class_weight" else None
        model = lgb.LGBMClassifier(
            n_estimators=200, learning_rate=0.05, num_leaves=31,
            class_weight=cw, n_jobs=-1, verbose=-1, random_state=random_state
        )
        model.fit(X_tr, y_tr, eval_X=X_val, eval_y=y_val_enc,
                  callbacks=[lgb.early_stopping(20, verbose=False), lgb.log_evaluation(-1)])
        
        y_pred = model.predict(X_val)
        macro = float(f1_score(y_val_enc, y_pred, average="macro", zero_division=0))
        from sklearn.metrics import recall_score
        rec = recall_score(y_val_enc, y_pred, labels=range(len(le.classes_)), average=None,
                           zero_division=0)
        results.append({"strategy": name, "macro_f1": round(macro, 4),
                        "recall": {c: round(float(r), 4) for c, r in zip(le.classes_, rec)}})
        print(f"  {name:20s}  macro-F1={macro:.4f}")

    out = Path("reports/model_comparison.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as fh:
        json.dump(results, fh, indent=2)
    print(f"Imbalance study saved to {out}")
    return results


def main(config_path, skip_lofo=False, holdout=None, imbalance_study=True):
    cfg = yaml.safe_load(open(config_path))
    started = time.time()

    df = load_processed(cfg["paths"]["processed"])
    # Analyst-labelled alerts added by scripts/retrain.py. They go into training
    # only and are kept out of the split, so a retrained model is evaluated on
    # exactly the test and LOFO sets the current one was.
    feedback = df.iloc[:0]
    if "feedback" in df.columns:
        is_fb = df["feedback"].fillna(False).astype(bool)
        feedback, df = df[is_fb].drop(columns="feedback"), df[~is_fb].drop(columns="feedback")
    df = df[df["family"].isin(TRAIN_FAMILIES + ["Infiltration", "Heartbleed"])]
    
    # Hold out Monday for drift evaluation (Benign traffic only)
    drift = None
    if "day" in df.columns:
        is_drift = df["day"] == "Monday"
        drift = df[is_drift].reset_index(drop=True)
        df = df[~is_drift].reset_index(drop=True)

    df = add_blocks(df, cfg["split"]["block_minutes"])

    train, val, test = make_splits(df, cfg["split"]["test_size"], cfg["split"]["random_state"])
    
    splits_dir = Path(cfg["paths"]["splits"])
    splits_dir.mkdir(parents=True, exist_ok=True)
    train.to_pickle(splits_dir / "train.pkl")
    val.to_pickle(splits_dir / "val.pkl")
    test.to_pickle(splits_dir / "test.pkl")
    if drift is not None and not drift.empty:
        drift.to_pickle(splits_dir / "drift.pkl")

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
    if len(feedback):
        # after downsampling: an analyst's "this was benign" is never sampled away
        train = pd.concat([train, feedback[feedback["family"].isin(TRAIN_FAMILIES)]],
                          ignore_index=True)
        print(f"added {len(feedback):,} analyst-labelled flows to training")

    print(f"train {len(train):,} | val {len(val):,} | test {len(test):,} | features {len(features)}")

    # handbook: compare no handling, class weights, benign undersampling and SMOTE
    # on macro-F1 and per-class recall, and show the ones not chosen too
    imbalance = None
    if imbalance_study and not holdout:
        imbalance = _run_imbalance_study(train, val, features, cfg["split"]["random_state"])

    # --- classifier -------------------------------------------------------
    kind, model = clf_mod.build(cfg["train"]["classifier"], cfg["split"]["random_state"])
    model.fit(matrix(train, features), train["family"])
    print(f"classifier: {kind}")

    base = clf_mod.baseline(cfg["split"]["random_state"],
                            cfg.get("classifier", {}).get("random_forest", {}).get("n_estimators", 300))
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

    # --- the alert rate the drift monitor compares against ----------------
    # Measured, not assumed: run benign validation traffic through the same
    # decision the API makes and count the Unknown alerts among flows the
    # classifier did not name. The live monitor counts the same thing, so a
    # burst of a known attack does not read as drift.
    bv = matrix(val[val["family"] == "Benign"], features)
    bv_known = clf_mod.attack_score(model, bv)[0] >= thr["threshold"]
    bv_fam, _ = clf_mod.predicted_family(model, model.predict_proba(bv))
    bv_ood = nov.is_out_of_family(nov.distance(bv, bv_fam), bv_fam)
    bv_flag = det.is_anomalous(det.score(bv))
    bv_named = bv_known & ~bv_ood
    bv_unknown = (bv_known & bv_ood) | (~bv_known & bv_flag)
    unexplained_rate = float(bv_unknown[~bv_named].mean()) if (~bv_named).any() else 0.0

    # --- honest evaluation on the held-out test set -----------------------
    known_test = test[test["family"].isin(TRAIN_FAMILIES)]
    Xt = matrix(known_test, features)
    proba = model.predict_proba(Xt)
    attack_score, _ = clf_mod.attack_score(model, Xt)
    fam, _ = clf_mod.predicted_family(model, proba)
    y_pred = np.where(attack_score >= thr["threshold"], fam, "Benign")

    sys_is_anomalous = det.is_anomalous(det.score(Xt))
    sys_ood = nov.is_out_of_family(nov.distance(Xt, fam), fam)
    sys_known = attack_score >= thr["threshold"]
    sys_alerted = sys_known | sys_is_anomalous
    sys_mislabelled = sys_known & sys_ood
    sys_shown = np.where(sys_known & ~sys_mislabelled, fam, "Unknown")
    sys_y_pred = np.where(sys_alerted, sys_shown, "Benign")

    main_summary = metrics.summarise(known_test["family"], y_pred,
                                     attack_score >= thr["threshold"],
                                     proba, model.classes_)

    sys_fpr = metrics.false_positive_rate(known_test["family"], sys_alerted)

    report = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "classifier": kind,
        "features": len(features),
        "rows": {"train": len(train), "val": len(val), "test": len(test)},
        "threshold": thr,
        "main": main_summary,
        "system": {
            "false_positive_rate": round(sys_fpr, 5),
            "false_alerts_per_10k_benign_flows": round(sys_fpr * 10000, 1),
            "macro_f1": round(float(f1_score(known_test["family"], sys_y_pred, average="macro", zero_division=0)), 4)
        }
    }

    base_proba = base.predict_proba(Xt)
    base_score, _ = clf_mod.attack_score(base, Xt)
    base_fam, _ = clf_mod.predicted_family(base, base_proba)
    if imbalance is not None:
        report["imbalance_study"] = {
            "evaluated_on": "validation split, LightGBM, macro-F1 and per-class recall",
            "chosen": cfg.get("imbalance_strategy", "class_weight"),
            "results": imbalance,
        }
    report["random_forest_baseline"] = metrics.summarise(
        known_test["family"], np.where(base_score >= 0.5, base_fam, "Benign"),
        base_score >= 0.5, base_proba, base.classes_)

    # What the out-of-family label check costs: correct alerts on families the
    # classifier was trained on that it nonetheless relabels Unknown.
    known_ood = nov.is_out_of_family(nov.distance(Xt, fam), fam)
    alerted = attack_score >= thr["threshold"]
    attacks = (known_test["family"] != "Benign").to_numpy()
    report["label_check_cost"] = {
        "alerts_on_known_families": int((alerted & attacks).sum()),
        "relabelled_unknown": round(float((alerted & attacks & known_ood).sum()
                                          / max((alerted & attacks).sum(), 1)), 4),
        "benign_relabelled_unknown": int((alerted & ~attacks & known_ood).sum()),
    }

    # novel families the classifier never saw
    novel = test[~test["family"].isin(TRAIN_FAMILIES)]
    if len(novel):
        Xn = matrix(novel, features)
        flagged = det.is_anomalous(det.score(Xn))
        n_attack, _ = clf_mod.attack_score(model, Xn)
        n_fam, _ = clf_mod.predicted_family(model, model.predict_proba(Xn))
        ood = nov.is_out_of_family(nov.distance(Xn, n_fam), n_fam)
        n_known = n_attack >= thr["threshold"]
        # Mirror decide() exactly: Unknown when the classifier alerts but its label
        # is rejected, or when the classifier is quiet but the detector objects.
        unknown = (n_known & ood) | (~n_known & flagged)
        report["novel_families"] = {
            "families": sorted(novel["family"].unique().tolist()),
            "flows": int(len(novel)),
            "alerted": round(float((n_known | flagged).mean()), 4),
            "caught_by_anomaly_detector": round(float(flagged.mean()), 4),
            "label_rejected_as_out_of_family": round(float(ood.mean()), 4),
            "shown_as_unknown": round(float(unknown.mean()), 4),
        }

    if not holdout:
        # Same model, same settings, random rows instead of time blocks: the gap is
        # what a leaky split would have let us claim. Comparison only.
        print("scoring the same model on a naive random split...")
        report["naive_comparison"] = naive.run(df[df["family"].isin(TRAIN_FAMILIES)],
                                               features, cfg, report["main"])
        nc = report["naive_comparison"]
        seeds = nc["macro_f1_over_seeds"]
        print(f"naive split macro-F1 {nc['macro_f1']} (range {seeds['min']}-{seeds['max']} over "
              f"{seeds['seeds']} seeds) vs honest {nc['honest_macro_f1']}; "
              f"{nc['test_flows_from_blocks_seen_in_training']:.0%} of naive test flows share a "
              f"time block with training"
              + ("" if nc["inflated"] else "; no inflation measured"))

    if not skip_lofo:
        print("running leave-one-family-out experiments...")
        report["lofo"] = lofo.run_all(train, val, test, features, LOFO_FAMILIES, cfg)

    # --- joint budget trade-off experiment --------------------------------
    print("running joint budget trade-off experiment...")
    trade_off = []
    bv_scores = det.score(matrix(val[val["family"] == "Benign"], features))
    nv_scores = det.score(Xn) if 'Xn' in locals() else None
    
    budget = cfg["train"]["fpr_budget"]
    for d_rate in [0.0, 0.001, 0.002, 0.003, 0.004, 0.005, 0.01]:
        d_thr = np.quantile(bv_scores, 1.0 - d_rate) if d_rate > 0 else float('inf')
        val_det_flags = det.score(matrix(val, features)) >= d_thr
        
        val_benign_mask = val["family"] == "Benign"
        val_is_attack = val["family"] != "Benign"
        
        max_c_alerts = int(budget * val_benign_mask.sum())
        det_alerts_on_benign = int((val_det_flags & val_benign_mask).sum())
        allowed_c_alerts = max_c_alerts - det_alerts_on_benign
        
        if allowed_c_alerts < 0:
            c_thr = float('inf')
            c_tpr = 0.0
        else:
            benign_not_flagged_scores = val_score[val_benign_mask & ~val_det_flags]
            if allowed_c_alerts >= len(benign_not_flagged_scores):
                c_thr = -float('inf')
            elif allowed_c_alerts == 0:
                c_thr = float('inf')
            else:
                c_thr = sorted(benign_not_flagged_scores, reverse=True)[allowed_c_alerts - 1]
            c_tpr = float((val_score[val_is_attack] >= c_thr).mean()) if val_is_attack.sum() > 0 else 0.0
            
        n_rec = 0.0
        if nv_scores is not None:
            n_flags = nv_scores >= d_thr
            n_known_ = locals().get('n_attack', np.zeros_like(nv_scores)) >= c_thr
            n_rec = float((n_flags | n_known_).mean())
            
        trade_off.append({
            "detector_flag_rate": d_rate,
            "classifier_threshold": round(float(c_thr), 4) if c_thr not in [float('inf'), -float('inf')] else None,
            "classifier_tpr_on_val": round(c_tpr, 4),
            "novel_recall": round(n_rec, 4) if nv_scores is not None else None
        })
        
    report["joint_budget_trade_off"] = trade_off

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
               "fpr_budget": cfg["train"]["fpr_budget"],
               # baseline for the drift monitor's alert-rate rule (see above)
               "benign_unexplained_alert_rate": round(unexplained_rate, 5)},
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
    ap.add_argument("--skip-imbalance", action="store_true",
                    help="skip the imbalance-strategy comparison (it runs by default)")
    ap.add_argument("--imbalance-study", action="store_true", help=argparse.SUPPRESS)  # old flag; now the default
    a = ap.parse_args()
    main(a.config, a.skip_lofo, a.holdout, not a.skip_imbalance)
