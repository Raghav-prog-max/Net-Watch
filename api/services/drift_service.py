def get_mock_drift_status():
    return {
        "status": "Stable",
        "psi_max": 0.05,
        "features": [
            {"name": "Flow Packets/s", "psi": 0.05},
            {"name": "SYN Flag Count", "psi": 0.01}
        ],
        "alert_rate_multiplier": 1.0,
        "recommendation": "No action needed"
    }
