import uuid
from datetime import datetime, timezone
from typing import Dict, Any

from ..schemas import FlowData
from .mitre import get_mitre_dict

FAMILY_WEIGHT = {
    "DDoS": 1.0, "Bot": 1.0, "WebAttack": 0.9, "DoS": 0.85,
    "BruteForce": 0.8, "Unknown": 0.8, "PortScan": 0.5
}

def severity_logic(confidence: float, anomaly_pct: float, family: str):
    weight = FAMILY_WEIGHT.get(family, 0.5)
    s = 100 * (0.5 * confidence + 0.3 * anomaly_pct + 0.2 * weight)
    if s >= 85:
        level = "Critical"
    elif s >= 65:
        level = "High"
    elif s >= 40:
        level = "Medium"
    else:
        level = "Low"
    return round(s), level

def score_flow(flow: FlowData) -> Dict[str, Any]:
    # Mocking the ML model evaluation for Phase 1-2
    # In a real scenario, this would load classifier.joblib and anomaly.joblib
    
    # Let's create a dummy scoring based on port as a mock
    if flow.dst_port == 80:
        family = "DoS"
        confidence = 0.94
        anomaly_score = 0.71
        is_novel = False
    elif flow.dst_port == 22:
        family = "BruteForce"
        confidence = 0.88
        anomaly_score = 0.80
        is_novel = False
    else:
        family = "Benign"
        confidence = 0.99
        anomaly_score = 0.10
        is_novel = False

    mitre_data = get_mitre_dict(family)
    
    anomaly_pct = anomaly_score # Mock mapping
    score_val, level_val = severity_logic(confidence, anomaly_pct, family)

    alert_id = f"alt_{uuid.uuid4().hex[:8]}"

    # Skip alerting if Benign and normal
    if family == "Benign" and anomaly_score < 0.5:
        return None # No alert

    explanation = [
        {"feature": "Flow Packets/s", "value": 48211.0, "impact": 0.32},
        {"feature": "SYN Flag Count", "value": 1.0, "impact": 0.18}
    ]

    alert = {
        "id": alert_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "flow": flow.model_dump(),
        "prediction": {"family": family, "confidence": confidence},
        "anomaly_score": anomaly_score,
        "is_novel": is_novel,
        "severity": {"score": score_val, "level": level_val},
        "explanation": explanation,
        "mitre": mitre_data,
        "recommended_action": "Investigate destination service; consider rate limiting",
        "status": "open",
        "analyst_label": None,
        "analyst_note": None,
        "model_version": "v1"
    }

    return alert
