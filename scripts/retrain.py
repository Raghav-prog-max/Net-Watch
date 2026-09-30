"""Retrain with analyst feedback as extra training data, then compare with v1.

Usage:
    python scripts/retrain.py [--config ml/config.yaml] [--out models/v2] [--skip-lofo]

Workflow (handbook, "Retraining path")
--------------------------------------
1. Read triaged alerts from the API's alert store (api/db/session.py DB_PATH).
2. Turn each into a training row: the model inputs stored with the alert, and
   a label the model knows. "false_positive" -> Benign; an analyst label that
   names a trained family -> that family. Anything else (free text, Unknown)
   cannot be learned from and is skipped, with a count.
3. Train v2 on the original data plus those rows. The rows go into training
   only (ml/train.py), so v2 is evaluated on exactly v1's test and LOFO sets.
4. Print the promotion check: promote only if macro-F1 improves and false
   alerts stay within the FPR budget.

Promotion is NOT automated: a person reviews the comparison and copies
models/v2 over models/v1. v1's reports/metrics.json is left untouched; v2's
report goes to reports/v2/.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def training_label(status, analyst_label, families):
    """The label a triaged alert teaches, or None if it teaches nothing usable."""
    if status == "false_positive":
        return "Benign"
    if analyst_label in families:
        return analyst_label
    return None


def export_feedback(families):
    """Triaged alerts from the API's alert store, as (features, family) rows."""
    from api.db.session import SessionLocal, ensure_schema
    from api.db.models import AlertModel

    ensure_schema()
    db = SessionLocal()
    try:
        rows = db.query(AlertModel).filter(
            (AlertModel.status == "false_positive") | (AlertModel.analyst_label.isnot(None))
        ).all()
        used, no_features, unmapped = [], 0, 0
        for r in rows:
            label = training_label(r.status, r.analyst_label, families)
            if label is None:
                unmapped += 1
            elif not r.features:
                no_features += 1          # scored before features were stored
            else:
                used.append({**r.features, "family": label})
        return used, {"triaged": len(rows), "used": len(used),
                      "skipped_no_features": no_features, "skipped_unusable_label": unmapped}
    finally:
        db.close()


def false_alerts_per_10k(report):
    """What analysts would see: the full system (classifier or detector). Reports
    written before that was measured carry only the classifier's figure."""
    if "system" in report:
        return report["system"]["false_alerts_per_10k_benign_flows"]
    return report["main"]["false_alerts_per_10k_benign_flows"]


def main(config_path: str, out_dir: str, skip_lofo: bool = False) -> None:
    import pandas as pd
    import yaml

    from ml.data.labels import TRAIN_FAMILIES
    from ml.train import main as train_main

    cfg = yaml.safe_load(open(ROOT / config_path))
    processed = ROOT / cfg["paths"]["processed"]
    if not processed.exists():
        raise SystemExit("run `make data` first")
    v1_report_path = ROOT / cfg["paths"]["reports_dir"] / "metrics.json"
    v1 = json.load(open(v1_report_path)) if v1_report_path.exists() else None

    rows, counts = export_feedback(TRAIN_FAMILIES)
    print("analyst feedback:", ", ".join(f"{k} {v}" for k, v in counts.items()))
    if not rows:
        print("no usable feedback: mark alerts as false positive, or label them with a "
              "family name, then run this again")
        return

    base = pd.read_pickle(processed)
    fb = pd.DataFrame(rows)
    fb["feedback"] = True
    combined = pd.concat([base, fb], ignore_index=True)
    combined_path = processed.with_name("flows_with_feedback.pkl")
    combined.to_pickle(combined_path)
    print(f"combined dataset: {len(base):,} flows + {len(fb):,} feedback -> {combined_path}")

    cfg["paths"]["processed"] = str(combined_path.relative_to(ROOT))
    cfg["paths"]["model_dir"] = out_dir
    cfg["paths"]["reports_dir"] = str(Path(cfg["paths"]["reports_dir"]) / Path(out_dir).name)
    cfg_tmp = ROOT / "ml" / "config_retrain.yaml"
    cfg_tmp.write_text(yaml.dump(cfg))
    try:
        print(f"training {out_dir} ...")
        v2 = train_main(str(cfg_tmp), skip_lofo=skip_lofo)
    finally:
        cfg_tmp.unlink(missing_ok=True)

    if v1 is None:
        print(f"no {v1_report_path}; compare manually")
        return
    budget = cfg["train"]["fpr_budget"] * 10000
    f1_1, f1_2 = v1["main"]["macro_f1"], v2["main"]["macro_f1"]
    fa_1, fa_2 = false_alerts_per_10k(v1), false_alerts_per_10k(v2)
    print("\npromotion check (same test set):")
    print(f"  v1  macro-F1 {f1_1}  false alerts/10k {fa_1}")
    print(f"  v2  macro-F1 {f1_2}  false alerts/10k {fa_2}  (budget {budget:g})")
    problems = []
    if f1_2 <= f1_1:
        problems.append(f"macro-F1 did not improve ({f1_2} <= {f1_1})")
    if fa_2 > budget:
        problems.append(f"false alerts over budget ({fa_2} > {budget:g})")
    if problems:
        print("  DO NOT PROMOTE: " + "; ".join(problems))
    else:
        print(f"  RECOMMEND PROMOTE: review, then copy {out_dir} over models/v1")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="ml/config.yaml")
    ap.add_argument("--out", default="models/v2")
    ap.add_argument("--skip-lofo", action="store_true")
    a = ap.parse_args()
    main(a.config, a.out, a.skip_lofo)
