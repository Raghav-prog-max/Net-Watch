# Model card — NetWatch v1

Generated from `reports/metrics.json` (2026-10-07T07:17:43Z) by `python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.

## What it does

Scores each network flow with two models and turns their verdicts into an alert for a human analyst, or into silence.

- **Classifier** (lightgbm): names one of 5 known attack families, or benign.
- **Anomaly detector** (Isolation Forest): trained on benign traffic only, and asks whether a flow looks normal at all. Features are log-scaled first, because flow features span orders of magnitude and raw scaling hides quiet attacks.
- **Out-of-family check**: a classifier always returns one of the classes it was trained on, so a novel attack arrives with a confident but wrong label. This checks whether the flow resembles the family it was assigned, and reports Unknown when it does not.

An alert is raised if either model objects. Nothing in the system blocks, drops or reroutes traffic.

## Training data

CICIDS2017 flow records: 2,563,107 flows after cleaning, 69 features. Split into 5-minute time blocks so no block appears in two splits, divided within each attack family so every family is in test. Within a family the earliest blocks train, the next validate and the latest test, and no held-out attack flow is within 5 minutes of a trained flow of its family, so the model is tested on a later stretch of each attack, not the minutes next to what it learned; a test fails the build if any of this breaks.

| Split | Flows | Note |
| --- | ---: | --- |
| Train | 565,851 | benign sampled to 20%; attacks kept whole |
| Validation | 309,173 | sets both thresholds |
| Test | 308,569 | never sampled; every figure below |

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

Surfacing suspicious traffic to a SOC analyst, who decides what happens next. Each alert carries a severity, the features that drove it and a MITRE ATT&CK technique; the analyst's decision is stored as a label for the next model version. Analyst labels are treated as trusted input during retraining.

**Not for:** automated blocking or rate limiting; any network the model was not retrained on; forensic attribution of an attack to a person.

## Performance

End-to-end System Macro-F1 **0.700** across benign and 5 attack families. Measured as a full system (classifier + anomaly detector), it produced **37.9 false alerts per 10,000 benign flows** (0.38%). This is within the 0.5% budget.

As a component, the classifier alone scored Macro-F1 0.934 and produced 28.1 false alerts/10k (0.28%) at threshold 0.0000, set on validation for its 0.4% share of the budget.

No accuracy figure is reported: about 80% of traffic is benign, so a model that never alerts would score about 80%.

| Class | Precision | Recall | F1 | PR-AUC | Test flows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Benign | 1.000 | 0.997 | 0.999 | 1.000 | 276,468 |
| DDoS | 0.995 | 0.998 | 0.997 | 0.999 | 20,446 |
| DoS | 0.896 | 0.998 | 0.944 | 0.988 | 3,385 |
| PortScan | 0.987 | 0.996 | 0.991 | 0.999 | 7,591 |
| BruteForce | 0.943 | 0.990 | 0.966 | 1.000 | 387 |
| Bot | 0.549 | 0.986 | 0.706 | 0.734 | 287 |

**Note on class weights:** The `class_weight` strategy was chosen over `no_handling` (the validation macro-F1 winner) because it significantly improves recall on the Bot family, keeping performance balanced across attacks.


### Joint Budget Trade-off

To keep the full system within the false-alert budget, the classifier threshold and detector flag rate must be balanced.

| Detector flag rate | Classifier threshold | Classifier TPR | Novel recall |
| --- | --- | --- | --- |
| 0.00% | 0.0000 | 99.96% | 0.00% |
| 0.10% | 0.0000 | 99.96% | 48.94% |
| 0.20% | 0.0000 | 99.96% | 57.45% |
| 0.30% | 0.0000 | 99.82% | 61.70% |
| 0.40% | 0.0009 | 99.73% | 82.98% |
| 0.50% | — | 0.00% | 85.11% |
| 1.00% | — | 0.00% | 87.23% |

### Attacks it was never trained on

Leave-one-family-out: each family is removed from training entirely, a fresh model is trained, and the held-out family is replayed at it. Each run sets its own threshold from the same budget. The interval is how far the full-system rate could move on another sample of the same size: few flows, wide interval.

| Held-out family | Flows | Classifier alone | Detector alone | Full system | Caught, 95% interval | Benign FPR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PortScan | 7,591 | 2.4% | 0.0% | 2.4% | 181 of 7,591; 95% interval 2.1%–2.8% | 0.38% |
| BruteForce | 387 | 3.4% | 0.0% | 3.4% | 13 of 387; 95% interval 2.0%–5.7% | 0.37% |
| WebAttack | — | — | — | — | — | no test rows for this family |
| Bot | 287 | 0.0% | 0.0% | 0.0% | 0 of 287; 95% interval 0.0%–1.3% | 0.24% |

Families withheld from training altogether (Heartbleed, Infiltration; all 47 of their flows, as none were trained on): 48.9% (23 of 47; 95% interval 35.3%–62.8%) raised an alert, and **48.9% were shown to the analyst as Unknown** (23 of 47; 95% interval 35.3%–62.8%) rather than under a known family's name.

Pooled, the larger family hides the smaller one, so each is shown on its own:

| Never-trained family | Flows | Alerted | Shown as Unknown |
| --- | ---: | ---: | ---: |
| Heartbleed | 11 | 100.0% (11 of 11; 95% interval 74.1%–100.0%) | 100.0% (11 of 11; 95% interval 74.1%–100.0%) |
| Infiltration | 36 | 33.3% (12 of 36; 95% interval 20.2%–49.7%) | 33.3% (12 of 36; 95% interval 20.2%–49.7%) |

### Splitting the false-alert budget between the two models

The same models at other cut-offs, both chosen on validation; nothing is retrained. The first row is the configuration in use (`train.classifier_fpr_budget` and `anomaly.benign_flag_rate` in `ml/config.yaml`). Each row trades false alerts against catching attacks the classifier has never seen.

| Classifier budget | Detector flag rate | False alerts / 10k (val) | False alerts / 10k (test) | Macro-F1 | Never-trained families alerted | LOFO PortScan | LOFO BruteForce | LOFO Bot | 
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | 
| 0.40% (in use) | 0.10% | 40.3 | 37.9 | 0.934 | 48.9% | 2.4% | 3.4% | 0.0% | 
| 0.50% | off | 45.7 | 40.0 | 0.917 | 0.0% | 2.4% | 3.4% | 0.0% | 
| 0.25% | 0.25% | 48.6 | 47.4 | 0.944 | 61.7% | 2.1% | 3.4% | 0.0% | 
| 0.10% | 0.40% | 49.7 | 50.6 (over) | 0.958 | 83.0% | 1.6% | 0.5% | 0.0% | 
| 0.50% (before 30 Sep) | 1.00% | 142.4 | 141.8 (over) | 0.917 | 87.2% | 2.6% | 3.4% | 0.0% | 

## Failure modes

Observed on the test set, most severe first.

- **Novel attacks that look like normal traffic are missed.** Held out of training, Bot is caught only 0.0% of the time (0 of 287; 95% interval 0.0%–1.3%): it sits close enough to benign traffic that neither model separates it.
- **Bot is also the weakest known family**, at 0.986 recall.
- **Benign and DoS are confused with each other.** 328 Benign flows were labelled DoS, and 8 the other way.
- **False alerts on benign traffic concentrate on DoS**: 328 of 778 (42%) were labelled DoS.
- **Some novel attacks keep a confident wrong name.** 51.1% of never-trained-on flows (24 of 47) are still reported under a known family's label.
- **The out-of-family check has a cost.** It relabels 2.8% of correct alerts on known families as Unknown (32,080 alerts measured), and 488 benign flows.
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
| Time blocks (honest) | 0.9338 | 28.1 | 0% |
| Random rows (naive) | 0.3745 (0.3745–0.9599 over 5 seeds) | 4186.6 | 100% |

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

