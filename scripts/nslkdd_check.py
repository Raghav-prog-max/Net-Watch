"""NSL-KDD sanity check of the metrics code (handbook task t4).

Usage:
    python scripts/nslkdd_check.py [--dir data/raw/nsl-kdd] [--trees 100]

NSL-KDD is small, well studied and has a fixed train/test file pair, so it is a
cheap way to check that ml/evaluate/metrics.py reports what it claims before we
trust it on CICIDS2017. This script:

1. Loads KDDTrain+ and KDDTest+ (.txt or .csv, 41 features + label, with or
   without the difficulty column) and maps each attack to its category:
   normal -> Benign, and DoS / Probe / R2L / U2R.
2. Trains a quick Random Forest on KDDTrain+ (one-hot protocol/service/flag).
3. Scores it twice: on a stratified 20% holdout of KDDTrain+, and on KDDTest+,
   which contains attack types absent from training and is known to be much
   harder.
4. Recomputes every headline number in `metrics.summarise` a second way, from
   raw counts and ranks without sklearn's metric functions, and fails if any
   of them disagree.

The model and its scores are not part of NetWatch; only the agreement check is
the point. Output: reports/nslkdd_check.json. Exit code 1 if a metric
disagrees, 2 if the data files are missing.

The files are not in the repository: put KDDTrain+.txt and KDDTest+.txt in
data/raw/nsl-kdd/ (see HOW_TO_RUN.md).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes", "land",
    "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in", "num_compromised",
    "root_shell", "su_attempted", "num_root", "num_file_creations", "num_shells",
    "num_access_files", "num_outbound_cmds", "is_host_login", "is_guest_login", "count",
    "srv_count", "serror_rate", "srv_serror_rate", "rerror_rate", "srv_rerror_rate",
    "same_srv_rate", "diff_srv_rate", "srv_diff_host_rate", "dst_host_count",
    "dst_host_srv_count", "dst_host_same_srv_rate", "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate", "dst_host_srv_diff_host_rate", "dst_host_serror_rate",
    "dst_host_srv_serror_rate", "dst_host_rerror_rate", "dst_host_srv_rerror_rate",
]
CATEGORICAL = ["protocol_type", "service", "flag"]
CLASSES = ["Benign", "DoS", "Probe", "R2L", "U2R"]

# The usual NSL-KDD attack taxonomy, including the attack types that appear only in KDDTest+.
CATEGORY = {"normal": "Benign"}
for cat, names in {
    "DoS": "back land neptune pod smurf teardrop apache2 mailbomb processtable udpstorm",
    "Probe": "ipsweep nmap portsweep satan mscan saint",
    "R2L": "ftp_write guess_passwd imap multihop phf spy warezclient warezmaster sendmail "
           "named snmpgetattack snmpguess xlock xsnoop worm",
    "U2R": "buffer_overflow loadmodule perl rootkit httptunnel ps sqlattack xterm",
}.items():
    CATEGORY.update({name: cat for name in names.split()})

TOLERANCE = 1e-4          # summarise rounds to 4 decimals


def find_file(data_dir: Path, stem: str) -> Path | None:
    for ext in (".txt", ".csv"):
        p = data_dir / f"{stem}{ext}"
        if p.exists():
            return p
    return None


def load(path: Path) -> pd.DataFrame:
    """One NSL-KDD file as COLUMNS + `label` (raw attack name) + `family` (category)."""
    df = pd.read_csv(path, header=None, low_memory=False)
    if str(df.iloc[0, 0]).strip().lower() == "duration":      # a copy with a header row
        df = df.iloc[1:].reset_index(drop=True)
    if df.shape[1] not in (42, 43):
        raise ValueError(f"{path.name}: expected 42 or 43 columns (41 features, label, "
                         f"optional difficulty), found {df.shape[1]}")
    df = df.iloc[:, :42]
    df.columns = COLUMNS + ["label"]
    df["label"] = df["label"].astype(str).str.strip().str.rstrip(".").str.lower()
    unknown = sorted(set(df["label"]) - set(CATEGORY))
    if unknown:
        raise ValueError(f"{path.name}: attack names not in the taxonomy: {unknown}")
    df["family"] = df["label"].map(CATEGORY)
    numeric = [c for c in COLUMNS if c not in CATEGORICAL]
    df[numeric] = df[numeric].apply(pd.to_numeric)
    return df


def encode(train: pd.DataFrame, *others: pd.DataFrame):
    """One-hot the categorical columns with the training file's categories only."""
    x_train = pd.get_dummies(train[COLUMNS], columns=CATEGORICAL, dtype=np.uint8)
    out = [x_train]
    for df in others:
        x = pd.get_dummies(df[COLUMNS], columns=CATEGORICAL, dtype=np.uint8)
        out.append(x.reindex(columns=x_train.columns, fill_value=0))
    return out


# --- the second way of computing each number: counts and ranks only ----------

def _roc_auc(binary, score):
    """Mann-Whitney U with average ranks for ties (equals the trapezoid ROC AUC)."""
    pos = binary.sum()
    neg = len(binary) - pos
    ranks = pd.Series(score).rank(method="average").to_numpy()
    return (ranks[binary == 1].sum() - pos * (pos + 1) / 2) / (pos * neg)


def _average_precision(binary, score):
    """Sum over distinct thresholds of (recall step) x (precision at that threshold)."""
    order = np.argsort(-score, kind="mergesort")
    s, b = score[order], binary[order]
    last = np.r_[np.flatnonzero(np.diff(s)), len(s) - 1]     # end of each tie group
    tp = np.cumsum(b)[last]
    precision = tp / (last + 1)
    recall = tp / b.sum()
    return float(np.sum(np.diff(np.r_[0, recall]) * precision))


def independent_metrics(y_true, y_pred, y_is_attack, proba, classes):
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    per_class, f1s = {}, []
    for c in classes:
        tp = np.sum((y_true == c) & (y_pred == c))
        fp = np.sum((y_true != c) & (y_pred == c))
        fn = np.sum((y_true == c) & (y_pred != c))
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        f = 2 * p * r / (p + r) if p + r else 0.0
        per_class[c] = {"precision": p, "recall": r, "f1-score": f, "support": int(tp + fn)}
        f1s.append(f)
    benign = y_true == "Benign"
    fpr = float(np.asarray(y_is_attack)[benign].mean()) if benign.any() else 0.0
    auc = {}
    for i, c in enumerate(classes):
        binary = (y_true == c).astype(int)
        if 0 < binary.sum() < len(binary):
            auc[c] = {"roc_auc": _roc_auc(binary, proba[:, i]),
                      "pr_auc": _average_precision(binary, proba[:, i])}
    return {"per_class": per_class, "macro_f1": float(np.mean(f1s)),
            "false_positive_rate": fpr, "auc": auc,
            "accuracy": float(np.mean(y_true == y_pred))}


def compare(summary: dict, ref: dict) -> list[str]:
    """Every number in `summary` that differs from `ref` by more than rounding."""
    pairs = [("macro_f1", summary["macro_f1"], ref["macro_f1"]),
             ("false_positive_rate", summary["false_positive_rate"], ref["false_positive_rate"]),
             ("accuracy", summary["accuracy_for_reference_only"], ref["accuracy"])]
    for c, m in ref["per_class"].items():
        got = summary["per_class"].get(c, {})
        pairs += [(f"{c} {k}", got.get(k), v) for k, v in m.items()]
    for c, m in ref["auc"].items():
        got = summary["auc"].get(c, {})
        pairs += [(f"{c} {k}", got.get(k), v) for k, v in m.items()]
    cm = np.array(summary["confusion_matrix"]["rows"])
    supports = [ref["per_class"][c]["support"] for c in summary["confusion_matrix"]["labels"]]
    pairs.append(("confusion matrix row sums", cm.sum(axis=1).tolist(), supports))
    bad = []
    for name, got, want in pairs:
        if got is None:
            bad.append(f"{name}: missing")
        elif isinstance(want, list):
            if got != want:
                bad.append(f"{name}: {got} != {want}")
        elif abs(float(got) - float(want)) > TOLERANCE:
            bad.append(f"{name}: summarise {got} vs recomputed {round(float(want), 6)}")
    return bad


def evaluate(model, x, y, classes):
    from ml.evaluate.metrics import summarise

    proba = model.predict_proba(x)
    order = [list(model.classes_).index(c) for c in classes]   # columns in `classes` order
    proba = proba[:, order]
    pred = np.array(classes)[proba.argmax(axis=1)]
    is_attack = pred != "Benign"
    summary = summarise(y, pred, is_attack, proba, classes)
    mismatches = compare(summary, independent_metrics(y, pred, is_attack, proba, classes))
    return summary, mismatches


def main(data_dir: str, trees: int, out: str) -> int:
    import yaml
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split

    data_dir = ROOT / data_dir
    train_path, test_path = find_file(data_dir, "KDDTrain+"), find_file(data_dir, "KDDTest+")
    if not (train_path and test_path):
        print(f"NSL-KDD not found: put KDDTrain+.txt and KDDTest+.txt in {data_dir}")
        return 2

    seed = yaml.safe_load(open(ROOT / "ml" / "config.yaml"))["split"]["random_state"]
    train, test = load(train_path), load(test_path)
    classes = [c for c in CLASSES if c in set(train["family"])]
    fit, hold = train_test_split(train, test_size=0.2, stratify=train["family"], random_state=seed)
    x_fit, x_hold, x_test = encode(fit, hold, test)

    model = RandomForestClassifier(n_estimators=trees, n_jobs=-1, random_state=seed)
    model.fit(x_fit, fit["family"])

    report = {"data": {"train_file": train_path.name, "test_file": test_path.name,
                       "train_rows": len(train), "test_rows": len(test),
                       "train_families": train["family"].value_counts().to_dict(),
                       "test_families": test["family"].value_counts().to_dict(),
                       "test_attack_types_not_in_train":
                           sorted(set(test["label"]) - set(train["label"]))},
              "model": {"type": "RandomForestClassifier", "n_estimators": trees, "seed": seed,
                        "features_after_one_hot": x_fit.shape[1]}}
    failed = False
    for name, x, y in (("holdout_20pct_of_KDDTrain+", x_hold, hold["family"].to_numpy()),
                       ("KDDTest+", x_test, test["family"].to_numpy())):
        summary, mismatches = evaluate(model, x, y, classes)
        summary.pop("curves")
        report[name] = {"summary": summary, "metric_mismatches": mismatches}
        failed |= bool(mismatches)
        recalls = ", ".join(f"{c} {summary['per_class'][c]['recall']:.3f}" for c in classes)
        print(f"{name}: macro-F1 {summary['macro_f1']}, accuracy "
              f"{summary['accuracy_for_reference_only']}, false alerts/10k benign "
              f"{summary['false_alerts_per_10k_benign_flows']}")
        print(f"  recall: {recalls}")
        print("  metrics agree with the independent recomputation" if not mismatches
              else "  METRIC MISMATCH:\n    " + "\n    ".join(mismatches))

    report["metrics_code_verified"] = not failed
    out_path = ROOT / out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2))
    print(f"wrote {out_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="data/raw/nsl-kdd")
    ap.add_argument("--trees", type=int, default=100)
    ap.add_argument("--out", default="reports/nslkdd_check.json")
    a = ap.parse_args()
    sys.exit(main(a.dir, a.trees, a.out))
