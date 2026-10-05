"""Which trained bundle the API serves, and the promotion check for a new one.

models/ACTIVE holds one line, the version the API loads ("v2"); without the file
it is v1. Promotion and rollback rewrite that line (scripts/promote.py), so every
bundle stays on disk. Promotion used to mean copying models/v2 over models/v1,
which left nothing to roll back to, and the API went on serving v1's report
beside v2's models.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"

# what api/services/scorer.py loads; a version without all of them cannot serve
BUNDLE_FILES = ("classifier.joblib", "anomaly.joblib", "novelty.joblib",
                "thresholds.json", "reference_stats.json")


def active_version(models: Path = MODELS) -> str:
    try:
        return (models / "ACTIVE").read_text(encoding="utf-8").strip() or "v1"
    except FileNotFoundError:
        return "v1"


def model_dir(version: str, models: Path = MODELS) -> Path:
    return models / version


def report_path(version: str, reports: Path = REPORTS) -> Path:
    """`make train` writes v1's report at the top of reports/; scripts/retrain.py
    writes each later version's into reports/<version>/."""
    return reports / ("metrics.json" if version == "v1" else f"{version}/metrics.json")


def missing_files(version: str, models: Path = MODELS) -> list:
    return [f for f in BUNDLE_FILES if not (model_dir(version, models) / f).exists()]


def false_alerts_per_10k(report: dict) -> float:
    """What analysts would see: the full system (classifier or detector). Reports
    written before that was measured carry only the classifier's figure."""
    if "system" in report:
        return report["system"]["false_alerts_per_10k_benign_flows"]
    return report["main"]["false_alerts_per_10k_benign_flows"]


def promotion_problems(current: dict, candidate: dict, budget_per_10k: float) -> list:
    """Why `candidate` should not replace `current` (handbook: promote only if
    macro-F1 improves and false alerts stay within the budget). Empty if it may."""
    problems = []
    f1_now, f1_new = current["main"]["macro_f1"], candidate["main"]["macro_f1"]
    if f1_new <= f1_now:
        problems.append(f"macro-F1 did not improve ({f1_new} <= {f1_now})")
    fa = false_alerts_per_10k(candidate)
    if fa > budget_per_10k:
        problems.append(f"false alerts over budget ({fa} > {budget_per_10k:g} per 10k)")
    return problems
