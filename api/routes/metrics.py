from fastapi import APIRouter
from ..services.drift_service import get_mock_drift_status

router = APIRouter()

@router.get("/metrics/model")
def get_model_metrics():
    # Mock data for Phase 1-2 based on handbook evaluation report expectations
    return {
        "macro_f1": 0.92,
        "per_class": [
            {"family": "DoS", "precision": 0.95, "recall": 0.96, "f1": 0.95, "pr_auc": 0.97, "roc_auc": 0.99},
            {"family": "BruteForce", "precision": 0.90, "recall": 0.88, "f1": 0.89, "pr_auc": 0.91, "roc_auc": 0.98}
        ],
        "fpr": {
            "rate": 0.005,
            "false_alerts_per_10k": 50
        },
        "confusion_matrix": [
            [0.99, 0.01, 0.0],
            [0.05, 0.95, 0.0],
            [0.10, 0.0, 0.90]
        ],
        "lofo_results": [
            {"held_out": "PortScan", "caught_by_classifier": "-", "caught_by_full_system": "-", "benign_fpr": "-"}
        ]
    }

@router.get("/metrics/drift")
def get_drift():
    return get_mock_drift_status()

@router.get("/models")
def get_models():
    return {
        "active_version": "v1",
        "versions": ["v1"],
        "model_card": "NetWatch Intrusion Detection System v1. Uses LightGBM and IsolationForest.",
        "feedback_labels_collected": 12
    }

