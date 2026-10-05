# Model card — NetWatch v1

Generated from `reports/metrics.json` (2026-10-05T04:30:34Z) by `python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.

## What it does

Scores each network flow with two models and turns their verdicts into an alert for a human analyst, or into silence.

- **Classifier** (lightgbm): names one of 6 known attack families, or benign.
- **Anomaly detector** (Isolation Forest): trained on benign traffic only, and asks whether a flow looks normal at all. Features are log-scaled first, because flow features span orders of magnitude and raw scaling hides quiet attacks.
- **Out-of-family check**: a classifier always returns one of the classes it was trained on, so a novel attack arrives with a confident but wrong label. This checks whether the flow resembles the family it was assigned, and reports Unknown when it does not.

An alert is raised if either model objects. Nothing in the system blocks, drops or reroutes traffic.

## Training data

CICIDS2017 flow records: 2,687,892 flows after cleaning, 70 features. Split into 5-minute time blocks so no block appears in two splits, divided within each attack family so every family is in test; a test fails the build if either breaks.

| Split | Flows | Note |
| --- | ---: | --- |
| Train | 477,925 | benign sampled to 20%; attacks kept whole |
| Validation | 299,213 | sets both thresholds |
| Test | 454,638 | never sampled; every figure below |

| Family | Flows | Role |
| --- | ---: | --- |
| Benign | 2,224,370 | trained |
| DoS | 199,420 | trained |
| DDoS | 128,023 | trained |
| PortScan | 119,922 | trained |
| BruteForce | 11,976 | trained |
| WebAttack | 2,180 | trained |
| Bot | 1,954 | trained |
| Infiltration | 36 | never trained on: test only |
| Heartbleed | 11 | never trained on: test only |

Removed before training so the model cannot memorise hosts: flow ID, source and destination IP, source port. The timestamp is kept only until the data is split.

## Intended use

Surfacing suspicious traffic to a SOC analyst, who decides what happens next. Each alert carries a severity, the features that drove it and a MITRE ATT&CK technique; the analyst's decision is stored as a label for the next model version.

**Not for:** automated blocking or rate limiting; any network the model was not retrained on; forensic attribution of an attack to a person.

## Performance

End-to-end System Macro-F1 **0.816** across benign and 6 attack families. Measured as a full system (classifier + anomaly detector), it produced **69.6 false alerts per 10,000 benign flows** (0.70%). This is over the 0.5% budget.

As a component, the classifier alone scored Macro-F1 0.943 and produced 58.2 false alerts/10k (0.58%) at threshold 0.0001, set on validation for its 0.4% share of the budget; on the test flows it is over that share.

No accuracy figure is reported: about 80% of traffic is benign, so a model that never alerts would score about 80%.

| Class | Precision | Recall | F1 | PR-AUC | Test flows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Benign | 1.000 | 0.994 | 0.997 | 0.999 | 265,050 |
| Bot | 0.488 | 1.000 | 0.656 | 0.955 | 284 |
| BruteForce | 0.996 | 1.000 | 0.998 | 1.000 | 2,024 |
| DDoS | 0.999 | 1.000 | 0.999 | 1.000 | 33,540 |
| PortScan | 0.982 | 1.000 | 0.991 | 0.993 | 69,064 |
| DoS | 0.998 | 0.997 | 0.997 | 1.000 | 84,302 |
| WebAttack | 0.945 | 0.986 | 0.965 | 0.993 | 368 |

**Note on class weights:** The `class_weight` strategy was chosen over `no_handling` (the validation macro-F1 winner) because it significantly improves recall on the Bot family, keeping performance balanced across attacks.


### Joint Budget Trade-off

To keep the full system within the false-alert budget, the classifier threshold and detector flag rate must be balanced.

| Detector flag rate | Classifier threshold | Classifier TPR | Novel recall |
| --- | --- | --- | --- |
| 0.00% | 0.0000 | 99.99% | 2.13% |
| 0.10% | 0.0000 | 99.99% | 48.94% |
| 0.20% | 0.0000 | 99.99% | 53.19% |
| 0.30% | 0.0002 | 99.99% | 57.45% |
| 0.40% | 0.2749 | 99.94% | 59.57% |
| 0.50% | — | 0.00% | 61.70% |
| 1.00% | — | 0.00% | 87.23% |

### Attacks it was never trained on

Leave-one-family-out: each family is removed from training entirely, a fresh model is trained, and the held-out family is replayed at it. Each run sets its own threshold from the same budget.

| Held-out family | Flows | Classifier alone | Detector alone | Full system | Benign FPR |
| --- | ---: | ---: | ---: | ---: | ---: |
| PortScan | 69,064 | 3.7% | 0.0% | 3.7% | 0.46% |
| BruteForce | 2,024 | 43.1% | 0.0% | 43.1% | 0.82% |
| WebAttack | 368 | 96.2% | 0.0% | 96.2% | 0.72% |
| Bot | 284 | 0.0% | 0.0% | 0.0% | 0.64% |

Families withheld from training altogether (Heartbleed, Infiltration; all 47 of their flows, as none were trained on): 48.9% raised an alert, and **46.8% were shown to the analyst as Unknown** rather than under a known family's name.

### Splitting the false-alert budget between the two models

The same models at other cut-offs, both chosen on validation; nothing is retrained. The first row is the configuration in use (`train.classifier_fpr_budget` and `anomaly.benign_flag_rate` in `ml/config.yaml`). Each row trades false alerts against catching attacks the classifier has never seen.

| Classifier budget | Detector flag rate | False alerts / 10k (val) | False alerts / 10k (test) | Macro-F1 | Never-trained families alerted | LOFO PortScan | LOFO BruteForce | LOFO WebAttack | LOFO Bot | 
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | 
| 0.40% (in use) | 0.10% | 31.8 | 69.6 (over) | 0.943 | 48.9% | 3.7% | 43.1% | 96.2% | 0.0% | 
| 0.50% | off | 22.0 | 58.2 (over) | 0.943 | 2.1% | 8.0% | 43.1% | 96.5% | 0.0% | 
| 0.25% | 0.25% | 46.5 | 85.1 (over) | 0.943 | 57.5% | 2.0% | 4.1% | 96.2% | 0.0% | 
| 0.10% | 0.40% | 49.7 | 84.4 (over) | 0.970 | 59.6% | 0.4% | 0.0% | 26.9% | 0.0% | 
| 0.50% (before 30 Sep) | 1.00% | 121.2 | 146.6 (over) | 0.943 | 87.2% | 8.1% | 43.1% | 96.5% | 0.0% | 

## Failure modes

Observed on the test set, most severe first.

- **The system is over its false-alert budget.** Analysts would see 69.6 false alerts per 10,000 benign flows against a budget of 50, because the anomaly detector's flags come on top of the classifier's. The table above shows splits of the budget that stay within it.
- **Novel attacks that look like normal traffic are missed.** Held out of training, Bot is caught only 0.0% of the time: it sits close enough to benign traffic that neither model separates it.
- **WebAttack is the weakest known family**, at 0.986 recall.
- **Benign and PortScan are confused with each other.** 994 Benign flows were labelled PortScan.
- **False alerts on benign traffic concentrate on PortScan**: 994 of 1,542 (64%) were labelled PortScan.
- **Some novel attacks keep a confident wrong name.** 53.2% of never-trained-on flows are still reported under a known family's label.
- **The out-of-family check has a cost.** It relabels 0.4% of correct alerts on known families as Unknown (189,582 alerts measured), and 52 benign flows.
- **Drift raises the false-alert rate.** As normal traffic changes shape it moves away from what the detector learned, so more of it alerts, and some reads as Unknown.

## Known limitations

- CICIDS2017 is lab traffic from 2017. Deployment needs retraining on the network's own flows; the pipeline and evaluation carry over, the trained weights do not.
- Flow features only: no payload inspection, no analysis of encrypted content.
- In CICIDS2017, Infiltration (36 flows) and Heartbleed (11 flows) are too rare to learn. They are handled only by the anomaly detector.
- Destination port is a feature. On real traffic that lets the model partly learn which ports an attack uses rather than how it behaves.
- Thresholds are set once, on validation. A production system would re-tune them against analyst feedback.

## Naive random split vs honest time split

The same classifier, settings, benign downsampling and threshold rule, with only the split changed: random rows instead of whole 5-minute blocks.

| Split | Macro-F1 | False alerts / 10k benign | Test flows from a block also in training |
| --- | --- | --- | --- |
| Time blocks (honest) | 0.9434 | 58.2 | 0% |
| Random rows (naive) | 0.9445 (0.9445–0.9604 over 5 seeds) | 32.6 | 100% |

The random split scores higher on every seed, by +0.001 macro-F1 on the main one. That gap is what a leaky evaluation would have let us claim.

**Not yet measured** — the handbook also requires a cross-dataset test on UNSW-NB15.

## Monitoring

The Population Stability Index is computed per feature over a window of 5,000 flows, against 10 quantile bins taken from benign validation traffic. Only flows that did not alert are counted, so a busy attack hour does not read as drift.

| Status | Rule |
| --- | --- |
| Stable | every feature below PSI 0.1 |
| Warning | any feature above PSI 0.1 |
| Drift | three or more features above PSI 0.25 |

At Drift the dashboard recommends retraining. A person approves it; nothing retrains on its own.

A KS test runs on 15 features, and the rate of Unknown alerts is compared with its benign-validation baseline: Warning above 1.5x, Drift above 2.0x only when PSI has moved too. Retraining (`make retrain`) adds analyst labels and is promoted only by a person, if macro-F1 improves and the full system stays within the false-alert budget.

The drift report also carries the family mix of recent alerts, the share of recent alerts analysts marked as false positives, and a snapshot history (`GET /metrics/drift`; see `docs/drift_strategy.md`).

## Reproducing these numbers

```bash
make data                        # raw CSVs -> data/processed/flows.pkl
make train                       # both models, thresholds, LOFO -> reports/metrics.json
python -m ml.evaluate.model_card # this card
```

