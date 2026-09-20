"""The contract. Frozen on day 2: frontend and backend both build against this."""
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Flow(BaseModel):
    """One network flow. Keys must match the trained feature names."""
    features: Dict[str, float]
    meta: Dict[str, str] = Field(default_factory=dict)  # dst_port, protocol, source host label


class ScoreRequest(BaseModel):
    flows: List[Flow]


class Explanation(BaseModel):
    feature: str
    value: float
    impact: float


class Alert(BaseModel):
    id: str
    timestamp: str
    flow: Dict[str, str]
    prediction: Dict[str, float | str]
    anomaly_score: float
    is_novel: bool
    severity: Dict[str, int | str]
    explanation: List[Explanation]
    mitre: Dict[str, str]
    recommended_action: str
    status: str = "open"
    analyst_label: Optional[str] = None
    analyst_note: Optional[str] = None
    model_version: str = "v1"


class Triage(BaseModel):
    status: str                      # acknowledged | escalated | false_positive | resolved
    analyst_label: Optional[str] = None
    analyst_note: Optional[str] = None
