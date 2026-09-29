"""Retrain the classifier using analyst-labelled alerts as additional data.

Usage:
    python scripts/retrain.py [--config ml/config.yaml] [--out models/v2]

Workflow
--------
1. Export all alerts where analyst_label is not NULL from the database.
2. Build a new training DataFrame: original training data + labelled alerts.
3. Call ml.train.main() with the combined data written to a temp parquet.
4. Evaluate v2 against the same test set as v1.
5. Print a promotion recommendation: promote if macro-F1 improves and FPR
   stays within budget; the person runs the promotion manually.

The actual promotion (copying models/v2 -> models/active) is intentionally
NOT automated. A human must review the comparison and decide.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def export_labels(db_url: str | None = None):
    """Pull analyst-labelled alerts from the database."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import yaml

    cfg = yaml.safe_load(open(ROOT / "ml" / "config.yaml"))
    if db_url is None:
        db_path = ROOT / "data" / "alerts.db"
        db_url = f"sqlite:///{db_path}"

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        from api.db.models import AlertModel
        rows = db.query(AlertModel).filter(AlertModel.analyst_label.isnot(None)).all()
        return [
            {
                "id": r.id,
                "family": r.analyst_label,
                "flow_features": r.flow,
                "model_prediction": r.prediction.get("family") if r.prediction else None,
            }
            for r in rows
        ]
    finally:
        db.close()


def main(config_path: str, out_dir: str) -> None:
    import yaml
    import pandas as pd

    cfg = yaml.safe_load(open(config_path))
    processed = ROOT / cfg["paths"]["processed"]

    if not processed.exists():
        raise SystemExit("run `make data` first")

    labels = export_labels()
    print(f"found {len(labels)} analyst-labelled alerts")

    if len(labels) == 0:
        print("no analyst labels found — retrain with `make train` instead")
        return

    # Build a minimal feedback frame from the labelled alerts
    # Feature values in the DB are stored as string-keyed meta dicts;
    # we map them back onto the feature columns the model expects.
    from ml.features.select import feature_columns
    df_base = pd.read_pickle(processed)
    features = feature_columns(df_base)

    feedback_rows = []
    for lab in labels:
        feats = lab.get("flow_features") or {}
        row = {f: float(feats.get(f, 0.0)) for f in features}
        row["family"] = lab["family"]
        feedback_rows.append(row)

    df_feedback = pd.DataFrame(feedback_rows)
    df_combined = pd.concat([df_base, df_feedback], ignore_index=True)
    combined_path = ROOT / "data" / "processed" / "flows_with_feedback.pkl"
    df_combined.to_pickle(combined_path)
    print(f"combined dataset: {len(df_combined):,} rows -> {combined_path}")

    # Override the processed path and model_dir for v2, then retrain
    cfg["paths"]["processed"] = str(combined_path.relative_to(ROOT))
    cfg["paths"]["model_dir"] = out_dir
    cfg_tmp = ROOT / "ml" / "config_v2.yaml"
    import yaml
    with open(cfg_tmp, "w") as fh:
        yaml.dump(cfg, fh)

    from ml.train import main as train_main
    print(f"training v2 -> {out_dir} ...")
    report = train_main(str(cfg_tmp), skip_lofo=True)

    v1_report_path = ROOT / cfg_original["paths"]["reports_dir"] / "metrics.json"
    if v1_report_path.exists():
        v1 = json.load(open(v1_report_path))
        v1_f1 = v1["main"]["macro_f1"]
        v1_fpr = v1["main"]["false_alerts_per_10k_benign_flows"]
        v2_f1 = report["main"]["macro_f1"]
        v2_fpr = report["main"]["false_alerts_per_10k_benign_flows"]
        fpr_budget = cfg_original["train"]["fpr_budget"] * 10000
        print(f"\nPromotion check:")
        print(f"  v1  macro-F1={v1_f1}  FP/10k={v1_fpr}")
        print(f"  v2  macro-F1={v2_f1}  FP/10k={v2_fpr}")
        improve = v2_f1 > v1_f1
        within_budget = v2_fpr <= fpr_budget
        if improve and within_budget:
            print("  RECOMMEND PROMOTE: v2 improves F1 and stays within FPR budget.")
            print(f"  Run: copy {out_dir} -> models/v1 (after your own review)")
        else:
            reasons = []
            if not improve:
                reasons.append(f"F1 did not improve ({v2_f1} <= {v1_f1})")
            if not within_budget:
                reasons.append(f"FPR over budget ({v2_fpr} > {fpr_budget})")
            print(f"  DO NOT PROMOTE: {'; '.join(reasons)}")
    else:
        print("v1 metrics not found; compare manually")

    cfg_tmp.unlink(missing_ok=True)
    print("done")


if __name__ == "__main__":
    import yaml
    cfg_original = yaml.safe_load(open(ROOT / "ml" / "config.yaml"))

    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="ml/config.yaml")
    ap.add_argument("--out", default="models/v2")
    args = ap.parse_args()
    main(args.config, args.out)
