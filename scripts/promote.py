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
    """Make `version` the active bundle and return the one it replaced. Raises
    SystemExit, changing nothing, if it may not."""
    current = registry.active_version(models)
    if version == current:
        raise SystemExit(f"{version} is already active")
    missing = registry.missing_files(version, models)
    if missing:
        raise SystemExit(f"{registry.model_dir(version, models)} is not a complete bundle: "
                         f"missing {', '.join(missing)}")
    if not rollback:
        now_path, new_path = registry.report_path(current, reports), registry.report_path(version, reports)
        for p in (now_path, new_path):
            if not p.exists():
                raise SystemExit(f"{p} not found: the promotion check compares both reports")
        problems = registry.promotion_problems(json.load(open(now_path)), json.load(open(new_path)),
                                               budget_per_10k)
        if problems:
            raise SystemExit(f"not promoting {version} over {current}: " + "; ".join(problems))
    (models / "ACTIVE").write_text(version + "\n", encoding="utf-8")
    return current


def main():
    import yaml

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("version", help="a bundle under models/, e.g. v2")
    ap.add_argument("--rollback", action="store_true",
                    help="switch back without the promotion check")
    ap.add_argument("--config", default="ml/config.yaml")
    a = ap.parse_args()
    cfg = yaml.safe_load(open(ROOT / a.config))
    replaced = promote(a.version, a.rollback, cfg["train"]["fpr_budget"] * 10000)
    print(f"active: {a.version} (was {replaced}; models/{replaced} is kept for rollback: "
          f"python scripts/promote.py {replaced} --rollback). Restart the API to load it.")


if __name__ == "__main__":
    main()
