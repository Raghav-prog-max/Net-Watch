"""Leave-one-family-out: the experiment that answers the brief's headline claim.

Remove one attack family from training entirely, then measure how much of it the
classifier catches alone versus the classifier plus the anomaly detector.
"""
import numpy as np

from ml.features.select import matrix
from ml.models import classifier as clf_mod
from ml.models.anomaly import AnomalyDetector
from ml.data.split import lofo_split, downsample_benign
from ml.evaluate import system
from ml.evaluate.thresholds import pick_threshold


def run_one(train, val, test, features, family, cfg, budget_splits=()):
    tr, va = lofo_split(train, val, family)
    tr = downsample_benign(tr, cfg["train"]["benign_downsample"])

    _, model = clf_mod.build(cfg["train"]["classifier"])
    model.fit(matrix(tr, features), tr["family"])

    benign = tr[tr["family"] == "Benign"]
    det = AnomalyDetector(cfg["anomaly"]["n_estimators"],
                          min(cfg["anomaly"]["max_samples"], max(len(benign), 1)))
    det.fit(matrix(benign, features))
    det.calibrate(matrix(va[va["family"] == "Benign"], features),
                  cfg["anomaly"]["benign_flag_rate"])

    # same rule as the main run: the threshold comes from the FPR budget on this
    # run's own validation split, not from 0.5. The held-out family is absent from
    # va, which is the point -- you cannot tune against an attack you have not seen.
    va_score, _ = clf_mod.attack_score(model, matrix(va, features))
    thr = pick_threshold(va["family"] != "Benign", va_score, system.classifier_budget(cfg))

    held = test[test["family"] == family]
    benign = test[test["family"] == "Benign"]
    if len(held) == 0:
        return {"family": family, "note": "no test rows for this family"}

    def scores(rows):
        X = matrix(rows, features)
        return clf_mod.attack_score(model, X)[0], det.score(X)

    h_score, h_det = scores(held)
    b_score, b_det = scores(benign)
    h_clf, h_anom = h_score >= thr["threshold"], det.is_anomalous(h_det)
    b_clf, b_anom = b_score >= thr["threshold"], det.is_anomalous(b_det)

    # the same experiment at other splits of the FPR budget (ml/evaluate/system.py):
    # no retraining, only the two cut-offs move, both chosen on this run's validation
    at_splits = []
    for split in budget_splits:
        t_clf, t_det = system.thresholds_for(split, va["family"] != "Benign", va_score, det)
        at_splits.append({
            "classifier_budget": split[0], "detector_flag_rate": split[1],
            "caught_by_full_system": round(float(((h_score >= t_clf) | (h_det >= t_det)).mean()), 4),
            "benign_fpr": round(float(((b_score >= t_clf) | (b_det >= t_det)).mean()), 5),
        })

    return {
        "family": family,
        "test_flows": int(len(held)),
        "attack_threshold": round(float(thr["threshold"]), 4),
        "caught_by_classifier_alone": round(float(h_clf.mean()), 4),
        "caught_by_anomaly_detector_alone": round(float(h_anom.mean()), 4),
        "caught_by_full_system": round(float((h_clf | h_anom).mean()), 4),
        "benign_fpr": round(float((b_clf | b_anom).mean()), 5),
        "budget_splits": at_splits,
    }


def run_all(train, val, test, features, families, cfg, budget_splits=()):
    return [run_one(train, val, test, features, f, cfg, budget_splits) for f in families]
