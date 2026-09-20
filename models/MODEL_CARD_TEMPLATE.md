# Model card — NetWatch v1

Fill this in from `reports/metrics.json` after training. Ships with the repo.

## What it does
Labels network flows as benign or as one of six attack families, and flags flows
that do not resemble benign traffic even when they match no known family.

## Training data
CICIDS2017 flow records, <N> rows after cleaning, split by 5-minute time blocks.
Identifiers (flow ID, IPs, source port) removed before training.

## Intended use
Surfacing suspicious traffic to a human analyst. Not for automated blocking.

## Performance (fill from reports/metrics.json)
- Macro-F1: —
- Per-class recall: —
- False alerts per 10,000 benign flows: —
- Novel families caught by the anomaly detector: —

## Known limitations
- Lab traffic from 2017; real deployment requires retraining on local flows.
- Flow features only: no payload inspection, no encrypted-traffic analysis.
- Infiltration (36 flows) and Heartbleed (11 flows) are too rare to learn and are
  handled only by the anomaly detector.
- Attacks that behave statistically like normal traffic will not be flagged.

## Monitoring
PSI per feature against training, alert-rate tracking, analyst false-positive rate.
Retraining is recommended by the system and approved by a person.
