from .session import Base, SQLALCHEMY_AVAILABLE

if SQLALCHEMY_AVAILABLE:
    from sqlalchemy import Column, String, Float, Boolean, DateTime, JSON, Integer

    class AlertModel(Base):
        __tablename__ = "alerts"

        id = Column(String, primary_key=True, index=True)
        timestamp = Column(DateTime, index=True)
        flow = Column(JSON)
        prediction = Column(JSON)
        anomaly_score = Column(Float)
        is_novel = Column(Boolean)
        severity = Column(JSON)
        explanation = Column(JSON)
        mitre = Column(JSON)
        recommended_action = Column(String)
        status = Column(String, default="open", index=True)
        analyst_label = Column(String, nullable=True)
        analyst_note = Column(String, nullable=True)
        model_version = Column(String)
        flow_count = Column(Integer, default=1)
        # the model inputs that produced the alert: what scripts/retrain.py needs
        # to turn an analyst's label into a training row. Not returned by the API.
        features = Column(JSON, nullable=True)
else:
    from .session import _ColumnExpr

    class AlertModel:
        __tablename__ = "alerts"

        id = _ColumnExpr("id")
        timestamp = _ColumnExpr("timestamp")
        status = _ColumnExpr("status")

        def __init__(
            self,
            id=None,
            timestamp=None,
            flow=None,
            prediction=None,
            anomaly_score=0.0,
            is_novel=False,
            severity=None,
            explanation=None,
            mitre=None,
            recommended_action=None,
            status="open",
            analyst_label=None,
            analyst_note=None,
            model_version="v1",
            flow_count=1,
            features=None,
        ):
            self.id = id
            self.timestamp = timestamp
            self.flow = flow
            self.prediction = prediction
            self.anomaly_score = anomaly_score
            self.is_novel = is_novel
            self.severity = severity
            self.explanation = explanation
            self.mitre = mitre
            self.recommended_action = recommended_action
            self.status = status
            self.analyst_label = analyst_label
            self.analyst_note = analyst_note
            self.model_version = model_version
            self.flow_count = flow_count
            self.features = features
