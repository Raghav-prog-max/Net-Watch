"""Retrain with analyst feedback as extra training data, then compare with the
bundle the API serves (v1 until a promotion).

Usage:
    python scripts/retrain.py [--config ml/config.yaml] [--out models/v2] [--skip-lofo]
    python scripts/promote.py v2              # if the check below recommends it

Workflow (handbook, "Retraining path")
--------------------------------------
1. Read triaged alerts from the API's alert store (api/db/session.py DB_PATH).
2. Turn each into a training row: the model inputs stored with the alert, and
   a label the model knows. "false_positive" -> Benign; an analyst label that
   names a trained family -> that family. Anything else (free text, Unknown)
   cannot be learned from and is skipped, with a count.
3. Train v2 on the original data plus those rows. The rows go into training
   only (ml/train.py), so v2 is evaluated on exactly v1's test and LOFO sets.
4. Print the promotion check against the active bundle (ml/registry.py):
   promote only if macro-F1 improves and false alerts stay within the FPR budget.

Promotion is NOT automated: a person reviews the comparison and runs
scripts/promote.py, which points models/ACTIVE at the new bundle. Nothing is
copied over v1: every bundle stays on disk to roll back to. v2's report goes to
reports/v2/; v1's reports/metrics.json is left untouched.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml import registry
from ml.registry import false_alerts_per_10k  # noqa: F401  (tests import it from here)


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
                # a grouped alert keeps the inputs of its flows as a list (capped
                # by MAX_GROUP_SAMPLES in api/routes/score.py); one stored
                # before grouping kept a single dict
                samples = r.features if isinstance(r.features, list) else [r.features]
                used.extend({**f, "family": label} for f in samples)
        return used, {"triaged": len(rows), "used": len(used),
                      "skipped_no_features": no_features, "skipped_unusable_label": unmapped}
    finally:
        db.close()


def main(config_path: str, out_dir: str, skip_lofo: bool = False) -> None:
    import pandas as pd
    import yaml

    from ml.data.labels import TRAIN_FAMILIES
    from ml.train import main as train_main

    # compared with what the API serves now; never written over, so it can be
    # rolled back to
    current = registry.active_version()
    out_name = Path(out_dir).name
    if out_name in ("v1", current):
        raise SystemExit(f"{out_dir} is {'the bundle `make train` writes' if out_name == 'v1' else 'the active bundle'}: "
                         "retraining into it would leave nothing to roll back to. Pass a new --out.")
    cfg = yaml.safe_load(open(ROOT / config_path))
    processed = ROOT / cfg["paths"]["processed"]
    if not processed.exists():
        raise SystemExit("run `make data` first")
    current_report_path = registry.report_path(current)
    current_report = json.load(open(current_report_path)) if current_report_path.exists() else None

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

    if current_report is None:
        print(f"no {current_report_path}; compare manually")
        return
    budget = cfg["train"]["fpr_budget"] * 10000
    print(f"\npromotion check against the active bundle, {current} (same test set):")
    for name, r in ((current, current_report), (out_name, v2)):
        print(f"  {name}  macro-F1 {r['main']['macro_f1']}  false alerts/10k {false_alerts_per_10k(r)}")
    print(f"  (budget {budget:g})")
    problems = registry.promotion_problems(current_report, v2, budget)
    if problems:
        print("  DO NOT PROMOTE: " + "; ".join(problems))
    else:
        print(f"  RECOMMEND PROMOTE: review, then `python scripts/promote.py {out_name}`; "
              f"{current} stays in models/{current} to roll back to")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="ml/config.yaml")
    ap.add_argument("--out", default="models/v2")
    ap.add_argument("--skip-lofo", action="store_true")
    a = ap.parse_args()
    main(a.config, a.out, a.skip_lofo)
