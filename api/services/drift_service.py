"""api/services/drift_service.py

Handbook names this file explicitly.  Drift logic lives in two places:
  - ml/drift/monitor.py   : PSI calculation, status() rules
  - api/services/scorer.py: the live window of recent flows

This module is the single import point for the API layer so routes don't
have to know which underlying module does the work.
"""
from typing import Any, Dict

from ml.drift.monitor import status as _status, window_psi as _window_psi


def compute_drift(scorer) -> Dict[str, Any]:
    """Return the current drift report from a live Scorer instance.

    Parameters
    ----------
    scorer : api.services.scorer.Scorer
        The live scorer that holds the recent-flow window.

    Returns
    -------
    dict with keys: status, top_features, recommendation, alert_rate,
                    flows_seen, and (if warming up) a note.
    """
    return scorer.drift()
