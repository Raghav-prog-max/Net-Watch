# Model card — NetWatch v1

Generated from `reports/metrics.json` (2026-10-07T01:10:33Z) by `python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.

> **Every figure below comes from synthetic traffic, not CICIDS2017.** `data/raw/` holds output from `scripts/make_synthetic.py`, which exists so the pipeline can run before the real download lands. These numbers show the system works end to end; they are not results and must not be reported as such. Place the CICIDS2017 files in `data/raw/`, run `make data && make train`, and regenerate this card.

## What it does

Scores each network flow with two models and turns their verdicts into an alert for a human analyst, or into silence.

- **Classifier** (lightgbm): names one of 6 known attack families, or benign.
- **Anomaly detector** (Isolation Forest): trained on benign traffic only, and asks whether a flow looks normal at all. Features are log-scaled first, because flow features span orders of magnitude and raw scaling hides quiet attacks.
- **Out-of-family check**: a classifier always returns one of the classes it was trained on, so a novel attack arrives with a confident but wrong label. This checks whether the flow resembles the family it was assigned, and reports Unknown when it does not.

An alert is raised if either model objects. Nothing in the system blocks, drops or reroutes traffic.

## Training data

Synthetic traffic shaped like CICIDS2017: 60,000 flows after cleaning, 13 features. Split into 5-minute time blocks so no block appears in two splits, divided within each attack family so every family is in test. Within a family the earliest blocks train, the next validate and the latest test, and no held-out attack flow is within 5 minutes of a trained flow of its family, so the model is tested on a later stretch of each attack, not the minutes next to what it learned; a test fails the build if any of this breaks.

| Split | Flows | Note |
| --- | ---: | --- |
| Train | 12,226 | benign sampled to 20%; attacks kept whole |
| Validation | 10,384 | sets both thresholds |
| Test | 10,376 | never sampled; every figure below |

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

End-to-end System Macro-F1 **0.624** across benign and 6 attack families. Measured as a full system (classifier + anomaly detector), it produced **34.1 false alerts per 10,000 benign flows** (0.34%). This is within the 0.5% budget.

As a component, the classifier alone scored Macro-F1 0.714 and produced 31.0 false alerts/10k (0.31%) at threshold 0.6821, set on validation for its 0.4% share of the budget.

No accuracy figure is reported: about 80% of traffic is benign, so a model that never alerts would score about 80%.

| Class | Precision | Recall | F1 | PR-AUC | Test flows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Benign | 0.999 | 0.997 | 0.998 | 1.000 | 6,447 |
| PortScan | 1.000 | 1.000 | 1.000 | 1.000 | 1,009 |
| BruteForce | 1.000 | 0.967 | 0.983 | 0.996 | 365 |
| DDoS | 0.425 | 0.963 | 0.590 | 0.885 | 457 |
| WebAttack | 0.068 | 0.800 | 0.125 | 0.094 | 5 |
| DoS | 0.987 | 0.676 | 0.802 | 0.984 | 1,973 |
| Bot | 0.405 | 0.652 | 0.500 | 0.380 | 23 |

**Note on class weights:** The `class_weight` strategy was chosen over `no_handling` (the validation macro-F1 winner) because it significantly improves recall on the Bot family, keeping performance balanced across attacks.


### Joint Budget Trade-off

To keep the full system within the false-alert budget, the classifier threshold and detector flag rate must be balanced.

| Detector flag rate | Classifier threshold | Classifier TPR | Novel recall |
| --- | --- | --- | --- |
| 0.00% | 0.4839 | 97.30% | 100.00% |
| 0.10% | 0.7028 | 96.95% | 100.00% |
| 0.20% | 0.8619 | 96.47% | 100.00% |
| 0.30% | 0.9513 | 96.03% | 100.00% |
| 0.40% | 0.9980 | 94.41% | 100.00% |
| 0.50% | — | 0.00% | 100.00% |
| 1.00% | — | 0.00% | 100.00% |

### Attacks it was never trained on

Leave-one-family-out: each family is removed from training entirely, a fresh model is trained, and the held-out family is replayed at it. Each run sets its own threshold from the same budget.

| Held-out family | Flows | Classifier alone | Detector alone | Full system | Benign FPR |
| --- | ---: | ---: | ---: | ---: | ---: |
| PortScan | 1,009 | 0.0% | 98.0% | 98.0% | 0.48% |
| BruteForce | 365 | 100.0% | 0.3% | 100.0% | 0.36% |
| WebAttack | 5 | 100.0% | 80.0% | 100.0% | 0.53% |
| Bot | 23 | 26.1% | 4.3% | 30.4% | 0.14% |

Families withheld from training altogether (Heartbleed, Infiltration; all 600 of their flows, as none were trained on): 100.0% raised an alert, and **89.8% were shown to the analyst as Unknown** rather than under a known family's name.

### Splitting the false-alert budget between the two models

The same models at other cut-offs, both chosen on validation; nothing is retrained. The first row is the configuration in use (`train.classifier_fpr_budget` and `anomaly.benign_flag_rate` in `ml/config.yaml`). Each row trades false alerts against catching attacks the classifier has never seen.

| Classifier budget | Detector flag rate | False alerts / 10k (val) | False alerts / 10k (test) | Macro-F1 | Never-trained families alerted | LOFO PortScan | LOFO BruteForce | LOFO WebAttack | LOFO Bot | 
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | 
| 0.40% (in use) | 0.10% | 51.2 | 34.1 | 0.714 | 100.0% | 98.0% | 100.0% | 100.0% | 30.4% | 
| 0.50% | off | 49.6 | 38.8 | 0.712 | 100.0% | 0.0% | 100.0% | 100.0% | 26.1% | 
| 0.25% | 0.25% | 51.2 | 34.1 | 0.721 | 100.0% | 98.8% | 100.0% | 100.0% | 30.4% | 
| 0.10% | 0.40% | 51.2 | 32.6 | 0.729 | 100.0% | 99.4% | 100.0% | 100.0% | 30.4% | 
| 0.50% (before 30 Sep) | 1.00% | 148.7 | 107.0 (over) | 0.712 | 100.0% | 99.8% | 100.0% | 100.0% | 30.4% | 

## Failure modes

Observed on the test set, most severe first.

- **Novel attacks that look like normal traffic are missed.** Held out of training, Bot is caught only 30.4% of the time: it sits close enough to benign traffic that neither model separates it.
- **Bot is also the weakest known family**, at 0.652 recall.
- **DoS and DDoS are confused with each other.** 595 DoS flows were labelled DDoS, and 17 the other way.
- **Every false alert on benign traffic was labelled Bot** (all 20).
- **Some novel attacks keep a confident wrong name.** 10.2% of never-trained-on flows are still reported under a known family's label.
- **The out-of-family check has a cost.** It relabels 1.5% of correct alerts on known families as Unknown (3,825 alerts measured), and 1 benign flows.
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
| Time blocks (honest) | 0.7141 | 31.0 | 0% |
| Random rows (naive) | 0.906 (0.8982–0.9173 over 5 seeds) | 40.7 | 100% |

The random split scores higher on every seed, by +0.192 macro-F1 on the main one. That gap is what a leaky evaluation would have let us claim.

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

