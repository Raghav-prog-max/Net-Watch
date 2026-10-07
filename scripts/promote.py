"""Point the API at a trained model bundle: promote a retrained one, or roll back.

Usage:
    python scripts/promote.py v2              # only if it passes the promotion check
    python scripts/promote.py v1 --rollback   # back to v1, no check

Promotion rewrites models/ACTIVE (ml/registry.py). No bundle is copied or
deleted, so the one it replaces stays on disk to roll back to. The API reads
ACTIVE when it starts: restart it (`make api`) to load the change, and it then
serves that version's models and its report together.

The check is the handbook's, against the bundle being replaced, on the same test
set: macro-F1 must improve and the full system's false alerts must stay within
the budget (ml/config.yaml train.fpr_budget). A rollback skips it: going back to
a model that already ran is the point.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml import registry


def promote(version, rollback=False, budget_per_10k=50.0,
            models=registry.MODELS, reports=registry.REPORTS):
    """Make `version` the active bundle (by renaming it to v1, and archiving the old v1)."""
    if version == "v1":
        raise SystemExit(f"v1 is already production")
    
    missing = registry.missing_files(version, models)
    if missing:
        raise SystemExit(f"{registry.model_dir(version, models)} is not a complete bundle: "
                         f"missing {', '.join(missing)}")
                         
    if not rollback:
        now_path = registry.report_path("v1", reports)
        new_path = registry.report_path(version, reports)
        for p in (now_path, new_path):
            if not p.exists():
                raise SystemExit(f"{p} not found: the promotion check compares both reports")
        problems = registry.promotion_problems(json.load(open(now_path)), json.load(open(new_path)),
                                               budget_per_10k)
        if problems:
            raise SystemExit(f"not promoting {version} over v1: " + "; ".join(problems))
            
    # Archive current v1
    v1_model = models / "v1"
    v1_report = reports / "metrics.json"
    if v1_model.exists():
        x = 1
        while (models / f"1.{x}").exists():
            x += 1
        v1_model.rename(models / f"1.{x}")
        if v1_report.exists():
            (reports / f"1.{x}").mkdir(exist_ok=True)
            v1_report.rename(reports / f"1.{x}" / "metrics.json")
        print(f"Archived previous production v1 to 1.{x}")

    # Move version to v1
    (models / version).rename(models / "v1")
    version_report_dir = reports / version
    if version_report_dir.exists():
        version_report_file = version_report_dir / "metrics.json"
        if version_report_file.exists():
            version_report_file.rename(reports / "metrics.json")
        import shutil
        shutil.rmtree(version_report_dir, ignore_errors=True)
        
    (models / "ACTIVE").write_text("v1\n", encoding="utf-8")
    return "v1"


def main():
    import yaml

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("version", help="a bundle under models/, e.g. v2 or 1.1")
    ap.add_argument("--rollback", action="store_true",
                    help="switch back without the promotion check")
    ap.add_argument("--config", default="ml/config.yaml")
    a = ap.parse_args()
    cfg = yaml.safe_load(open(ROOT / a.config))
    promote(a.version, a.rollback, cfg["train"]["fpr_budget"] * 10000)
    print(f"active: v1 (was {a.version}). Restart the API to load it.")


if __name__ == "__main__":
    main()
