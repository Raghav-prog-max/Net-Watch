# Model card — NetWatch v1

Generated from `reports/metrics.json` (2026-10-07T02:56:56Z) by `python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.

## What it does

Scores each network flow with two models and turns their verdicts into an alert for a human analyst, or into silence.

- **Classifier** (lightgbm): names one of 5 known attack families, or benign.
- **Anomaly detector** (Isolation Forest): trained on benign traffic only, and asks whether a flow looks normal at all. Features are log-scaled first, because flow features span orders of magnitude and raw scaling hides quiet attacks.
- **Out-of-family check**: a classifier always returns one of the classes it was trained on, so a novel attack arrives with a confident but wrong label. This checks whether the flow resembles the family it was assigned, and reports Unknown when it does not.

An alert is raised if either model objects. Nothing in the system blocks, drops or reroutes traffic.

## Training data

CICIDS2017 flow records: 2,563,107 flows after cleaning, 69 features. Split into 5-minute time blocks so no block appears in two splits, divided within each attack family so every family is in test; a test fails the build if either breaks.

| Split | Flows | Note |
| --- | ---: | --- |
| Train | 519,399 | benign sampled to 20%; attacks kept whole |
| Validation | 310,384 | sets both thresholds |
| Test | 311,178 | never sampled; every figure below |

| Family | Flows | Role |
| --- | ---: | --- |
| Benign | 2,137,366 | trained |
| DoS | 193,745 | trained |
| DDoS | 128,014 | trained |
| PortScan | 90,694 | trained |
| BruteForce | 9,150 | trained |
| Unknown | 2,143 | trained |
| Bot | 1,948 | trained |
| Infiltration | 36 | never trained on: test only |
| Heartbleed | 11 | never trained on: test only |

Removed before training so the model cannot memorise hosts: flow ID, source and destination IP, source port. The timestamp is kept only until the data is split.

## Intended use

Surfacing suspicious traffic to a SOC analyst, who decides what happens next. Each alert carries a severity, the features that drove it and a MITRE ATT&CK technique; the analyst's decision is stored as a label for the next model version.

**Not for:** automated blocking or rate limiting; any network the model was not retrained on; forensic attribution of an attack to a person.

## Performance

End-to-end System Macro-F1 **0.818** across benign and 5 attack families. Measured as a full system (classifier + anomaly detector), it produced **28.3 false alerts per 10,000 benign flows** (0.28%). This is within the 0.5% budget.

As a component, the classifier alone scored Macro-F1 0.959 and produced 18.9 false alerts/10k (0.19%) at threshold 0.0002, set on validation for its 0.4% share of the budget.

No accuracy figure is reported: about 80% of traffic is benign, so a model that never alerts would score about 80%.

| Class | Precision | Recall | F1 | PR-AUC | Test flows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Benign | 1.000 | 0.998 | 0.999 | 1.000 | 242,793 |
| BruteForce | 0.990 | 1.000 | 0.995 | 1.000 | 1,360 |
| DDoS | 0.999 | 1.000 | 1.000 | 1.000 | 21,146 |
| DoS | 0.994 | 1.000 | 0.997 | 1.000 | 30,427 |
| PortScan | 0.998 | 1.000 | 0.999 | 1.000 | 15,093 |
| Bot | 0.627 | 0.988 | 0.767 | 0.942 | 342 |

**Note on class weights:** The `class_weight` strategy was chosen over `no_handling` (the validation macro-F1 winner) because it significantly improves recall on the Bot family, keeping performance balanced across attacks.


### Joint Budget Trade-off

To keep the full system within the false-alert budget, the classifier threshold and detector flag rate must be balanced.

| Detector flag rate | Classifier threshold | Classifier TPR | Novel recall |
| --- | --- | --- | --- |
| 0.00% | 0.0000 | 99.99% | 17.02% |
| 0.10% | 0.0001 | 99.99% | 48.94% |
| 0.20% | 0.0004 | 99.98% | 53.19% |
| 0.30% | 0.9985 | 99.38% | 59.57% |
| 0.40% | 1.0000 | 95.59% | 61.70% |
| 0.50% | — | 0.00% | 72.34% |
| 1.00% | — | 0.00% | 87.23% |

### Attacks it was never trained on

Leave-one-family-out: each family is removed from training entirely, a fresh model is trained, and the held-out family is replayed at it. Each run sets its own threshold from the same budget.

| Held-out family | Flows | Classifier alone | Detector alone | Full system | Benign FPR |
| --- | ---: | ---: | ---: | ---: | ---: |
| PortScan | 15,093 | 6.3% | 0.2% | 6.4% | 0.33% |
| BruteForce | 1,360 | 22.4% | 0.0% | 22.4% | 0.33% |
| WebAttack | — | — | — | — | no test rows for this family |
| Bot | 342 | 0.0% | 0.0% | 0.0% | 0.25% |

Families withheld from training altogether (Heartbleed, Infiltration; all 47 of their flows, as none were trained on): 46.8% raised an alert, and **46.8% were shown to the analyst as Unknown** rather than under a known family's name.

### Splitting the false-alert budget between the two models

The same models at other cut-offs, both chosen on validation; nothing is retrained. The first row is the configuration in use (`train.classifier_fpr_budget` and `anomaly.benign_flag_rate` in `ml/config.yaml`). Each row trades false alerts against catching attacks the classifier has never seen.

| Classifier budget | Detector flag rate | False alerts / 10k (val) | False alerts / 10k (test) | Macro-F1 | Never-trained families alerted | LOFO PortScan | LOFO BruteForce | LOFO Bot | 
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | 
| 0.40% (in use) | 0.10% | 43.3 | 28.3 | 0.959 | 46.8% | 6.4% | 22.4% | 0.0% | 
| 0.50% | off | 42.0 | 28.4 | 0.948 | 4.3% | 17.0% | 27.7% | 0.0% | 
| 0.25% | 0.25% | 49.8 | 34.8 | 0.974 | 57.5% | 6.4% | 0.0% | 0.0% | 
| 0.10% | 0.40% | 50.0 | 41.2 | 0.956 | 61.7% | 0.6% | 0.0% | 0.0% | 
| 0.50% (before 30 Sep) | 1.00% | 140.0 | 126.8 (over) | 0.948 | 87.2% | 17.1% | 27.7% | 1.2% | 

## Failure modes

Observed on the test set, most severe first.

- **Novel attacks that look like normal traffic are missed.** Held out of training, Bot is caught only 0.0% of the time: it sits close enough to benign traffic that neither model separates it.
- **Bot is also the weakest known family**, at 0.988 recall.
- **Benign and Bot are confused with each other.** 201 Benign flows were labelled Bot, and 4 the other way.
- **False alerts on benign traffic concentrate on Bot**: 201 of 460 (44%) were labelled Bot.
- **Some novel attacks keep a confident wrong name.** 53.2% of never-trained-on flows are still reported under a known family's label.
- **The out-of-family check has a cost.** It relabels 2.4% of correct alerts on known families as Unknown (68,364 alerts measured), and 39 benign flows.
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
| Time blocks (honest) | 0.9594 | 18.9 | 0% |
| Random rows (naive) | 0.4391 (0.4391–0.9599 over 5 seeds) | 4523.6 | 100% |

**No inflation was measured.** Every random split scored about the same as the honest one, although 100% of its test flows came from time blocks also used in training.

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

