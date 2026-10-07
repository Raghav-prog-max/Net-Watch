import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from api.db.session import SessionLocal, ensure_schema
from api.db.models import AlertModel
import random

ensure_schema()
db = SessionLocal()
try:
    alerts = db.query(AlertModel).all()
    count = 0
    for a in alerts:
        # Simulate analyst workflow:
        # If it's benign but got flagged, mark as false_positive
        # For simplicity of the demo, let's just mark some as false_positives and some with actual attack labels
        if random.random() < 0.5:
            a.status = "false_positive"
        else:
            a.status = "resolved"
            a.analyst_label = a.prediction if a.prediction != "Unknown" else "DDoS"
        count += 1
    db.commit()
    print(f"Triaged {count} alerts in DB for retraining.")
finally:
    db.close()
