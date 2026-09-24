# Model card — NetWatch v1

Generated from `reports/metrics.json` (2026-09-24T16:10:20Z) by `python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.

> **Every figure below comes from synthetic traffic, not CICIDS2017.** `data/raw/` holds output from `scripts/make_synthetic.py`, which exists so the pipeline can run before the real download lands. These numbers show the system works end to end; they are not results and must not be reported as such. Place the CICIDS2017 files in `data/raw/`, run `make data && make train`, and regenerate this card.

## What it does

Scores each network flow with two models and turns their verdicts into an alert for a human analyst, or into silence.

- **Classifier** (lightgbm): names one of 6 known attack families, or benign.
- **Anomaly detector** (Isolation Forest): trained on benign traffic only, and asks whether a flow looks normal at all. Features are log-scaled first, because flow features span orders of magnitude and raw scaling hides quiet attacks.
- **Out-of-family check**: a classifier always returns one of the classes it was trained on, so a novel attack arrives with a confident but wrong label. This checks whether the flow resembles the family it was assigned, and reports Unknown when it does not.

An alert is raised if either model objects. Nothing in the system blocks, drops or reroutes traffic.

## Training data

Synthetic traffic shaped like CICIDS2017: 60,000 flows after cleaning, 13 features. Split into 5-minute time blocks so no block appears in two splits; a test fails the build if one does.

| Split | Flows | Note |
| --- | ---: | --- |
| Train | 21,381 | benign sampled to 20%; attacks kept whole |
| Validation | 8,664 | sets both thresholds |
| Test | 9,324 | never sampled; every figure below |

| Family | Flows | Role |
| --- | ---: | --- |
| Benign | 36,000 | trained |
| DoS | 7,200 | trained |
| PortScan | 6,000 | trained |
| DDoS | 5,400 | trained |
| BruteForce | 2,400 | trained |
| Bot | 1,200 | trained |
| WebAttack | 1,200 | trained |
| Infiltration | 300 | never trained on: test only |
| Heartbleed | 300 | never trained on: test only |

Removed before training so the model cannot memorise hosts: flow ID, source and destination IP, source port. The timestamp is kept only until the data is split.

## Intended use

Surfacing suspicious traffic to a SOC analyst, who decides what happens next. Each alert carries a severity, the features that drove it and a MITRE ATT&CK technique; the analyst's decision is stored as a label for the next model version.

**Not for:** automated blocking or rate limiting; any network the model was not retrained on; forensic attribution of an attack to a person.

## Performance

Macro-F1 **0.917** across benign and 6 attack families. The alert threshold (0.9865) was chosen on validation to stay within a false-positive budget of 0.5%; on the test set it produced **42.9 false alerts per 10,000 benign flows** (0.43%), within budget.

No accuracy figure is reported: about 80% of traffic is benign, so a model that never alerts would score about 80%.

| Class | Precision | Recall | F1 | PR-AUC | Test flows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Benign | 0.996 | 0.996 | 0.996 | 1.000 | 5,598 |
| PortScan | 1.000 | 1.000 | 1.000 | 1.000 | 897 |
| BruteForce | 0.931 | 0.975 | 0.953 | 0.990 | 360 |
| DoS | 0.883 | 0.898 | 0.891 | 0.963 | 1,121 |
| WebAttack | 0.934 | 0.867 | 0.899 | 0.956 | 211 |
| DDoS | 0.869 | 0.854 | 0.861 | 0.951 | 848 |
| Bot | 0.832 | 0.801 | 0.816 | 0.852 | 186 |

### Attacks it was never trained on

Leave-one-family-out: each family is removed from training entirely, a fresh model is trained, and the held-out family is replayed at it. Each run sets its own threshold from the same budget.

| Held-out family | Flows | Classifier alone | Detector alone | Full system | Benign FPR |
| --- | ---: | ---: | ---: | ---: | ---: |
| PortScan | 897 | 0.0% | 99.7% | 99.7% | 1.30% |
| BruteForce | 360 | 100.0% | 3.1% | 100.0% | 1.27% |
| WebAttack | 211 | 100.0% | 92.9% | 100.0% | 1.32% |
| Bot | 186 | 15.6% | 3.8% | 17.7% | 0.88% |

Families withheld from training altogether (Heartbleed, Infiltration, 103 test flows): 100.0% raised an alert, and **93.2% were shown to the analyst as Unknown** rather than under a known family's name.

## Failure modes

Observed on the test set, most severe first.

- **Novel attacks that look like normal traffic are missed.** Held out of training, Bot is caught only 17.7% of the time: it sits close enough to benign traffic that neither model separates it.
- **Bot is also the weakest known family**, at 0.801 recall.
- **DDoS and DoS are confused with each other.** 124 DDoS flows were labelled DoS, and 109 the other way.
- **Every false alert on benign traffic was labelled Bot** (all 24).
- **Some novel attacks keep a confident wrong name.** 6.8% of never-trained-on flows are still reported under a known family's label.
- **The out-of-family check has a cost.** It relabels 0.9% of correct alerts on known families as Unknown (3,598 alerts measured); no benign flow was relabelled.
- **Drift raises the false-alert rate.** As normal traffic changes shape it moves away from what the detector learned, so more of it alerts, and some reads as Unknown.

## Known limitations

- CICIDS2017 is lab traffic from 2017. Deployment needs retraining on the network's own flows; the pipeline and evaluation carry over, the trained weights do not.
- Flow features only: no payload inspection, no analysis of encrypted content.
- In CICIDS2017, Infiltration (36 flows) and Heartbleed (11 flows) are too rare to learn. They are handled only by the anomaly detector.
- Destination port is a feature. On real traffic that lets the model partly learn which ports an attack uses rather than how it behaves.
- Thresholds are set once, on validation. A production system would re-tune them against analyst feedback.

**Not yet measured** — the handbook requires both: the same model scored on a random split beside the honest one, so the inflation gap is visible; and a cross-dataset test on UNSW-NB15.

## Monitoring

The Population Stability Index is computed per feature over a window of 5,000 flows, against 10 quantile bins taken from benign validation traffic. Only flows that did not alert are counted, so a busy attack hour does not read as drift.

| Status | Rule |
| --- | --- |
| Stable | every feature below PSI 0.1 |
| Warning | any feature above PSI 0.1 |
| Drift | three or more features above PSI 0.25 |

At Drift the dashboard recommends retraining. A person approves it; nothing retrains on its own.

**Not yet built** — the handbook specifies these as well: a KS test on the top 15 features; alert-rate rules (Warning above 1.5x baseline, Drift above 2x); tracking the share of alerts analysts mark as false positives; and v2 retraining, promoted only if macro-F1 improves and the false-positive rate stays within budget.

## Reproducing these numbers

```bash
make data                        # raw CSVs -> data/processed/flows.pkl
make train                       # both models, thresholds, LOFO -> reports/metrics.json
python -m ml.evaluate.model_card # this card
```

