"""Raw CICIDS2017 labels grouped into attack families."""

LABEL_MAP = {
    "BENIGN": "Benign",
    "DoS Hulk": "DoS",
    "DoS GoldenEye": "DoS",
    "DoS slowloris": "DoS",
    "DoS Slowhttptest": "DoS",
    "Heartbleed": "Heartbleed",          # 11 flows: test only
    "DDoS": "DDoS",
    "PortScan": "PortScan",
    "FTP-Patator": "BruteForce",
    "SSH-Patator": "BruteForce",
    "Web Attack \x96 Brute Force": "WebAttack",
    "Web Attack \x96 XSS": "WebAttack",
    "Web Attack \x96 Sql Injection": "WebAttack",
    "Web Attack - Brute Force": "WebAttack",
    "Web Attack - XSS": "WebAttack",
    "Web Attack - Sql Injection": "WebAttack",
    "Infiltration": "Infiltration",      # 36 flows: test only
    "Bot": "Bot",
}

# Families the classifier is allowed to learn.
TRAIN_FAMILIES = ["Benign", "DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Bot"]

# Too rare to train on. Held out entirely and used to test the anomaly detector.
NOVEL_ONLY = ["Infiltration", "Heartbleed"]

# Families removed one at a time in the leave-one-family-out experiment.
LOFO_FAMILIES = ["PortScan", "BruteForce", "WebAttack", "Bot"]


def to_family(raw_label: str) -> str:
    return LABEL_MAP.get(str(raw_label).strip(), "Unknown")
