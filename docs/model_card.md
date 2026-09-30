# Model card — NetWatch v1

Generated from `reports/metrics.json` (2026-09-30T10:41:27Z) by `python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.

> **Every figure below comes from synthetic traffic, not CICIDS2017.** `data/raw/` holds output from `scripts/make_synthetic.py`, which exists so the pipeline can run before the real download lands. These numbers show the system works end to end; they are not results and must not be reported as such. Place the CICIDS2017 files in `data/raw/`, run `make data && make train`, and regenerate this card.

## What it does

Scores each network flow with two models and turns their verdicts into an alert for a human analyst, or into silence.

- **Classifier** (lightgbm): names one of 5 known attack families, or benign.
- **Anomaly detector** (Isolation Forest): trained on benign traffic only, and asks whether a flow looks normal at all. Features are log-scaled first, because flow features span orders of magnitude and raw scaling hides quiet attacks.
- **Out-of-family check**: a classifier always returns one of the classes it was trained on, so a novel attack arrives with a confident but wrong label. This checks whether the flow resembles the family it was assigned, and reports Unknown when it does not.

An alert is raised if either model objects. Nothing in the system blocks, drops or reroutes traffic.

## Training data

Synthetic traffic shaped like CICIDS2017: 2,563,107 flows after cleaning, 69 features. Split into 5-minute time blocks so no block appears in two splits; a test fails the build if one does.

| Split | Flows | Note |
| --- | ---: | --- |
| Train | 517,341 | benign sampled to 20%; attacks kept whole |
| Validation | 308,995 | sets both thresholds |
| Test | 310,000 | never sampled; every figure below |

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
| Heartbleed | 11 | trained |

Removed before training so the model cannot memorise hosts: flow ID, source and destination IP, source port. The timestamp is kept only until the data is split.

## Intended use

Surfacing suspicious traffic to a SOC analyst, who decides what happens next. Each alert carries a severity, the features that drove it and a MITRE ATT&CK technique; the analyst's decision is stored as a label for the next model version.

**Not for:** automated blocking or rate limiting; any network the model was not retrained on; forensic attribution of an attack to a person.

## Performance

End-to-end System Macro-F1 **0.835** across benign and 5 attack families. Measured as a full system (classifier + anomaly detector), it produced **112.6 false alerts per 10,000 benign flows** (1.13%). This is over the 0.5% budget.

As a component, the classifier alone scored Macro-F1 0.979 and produced 9.0 false alerts/10k (0.09%), meeting its isolated budget constraint of 0.5% at threshold 0.0052.

No accuracy figure is reported: about 80% of traffic is benign, so a model that never alerts would score about 80%.

| Class | Precision | Recall | F1 | PR-AUC | Test flows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Benign | 1.000 | 0.999 | 1.000 | 1.000 | 236,177 |
| BruteForce | 0.995 | 1.000 | 0.998 | 1.000 | 1,254 |
| DDoS | 0.998 | 1.000 | 0.999 | 1.000 | 22,355 |
| PortScan | 1.000 | 1.000 | 1.000 | 1.000 | 23,771 |
| DoS | 0.997 | 1.000 | 0.998 | 1.000 | 26,110 |
| Bot | 0.803 | 0.973 | 0.880 | 0.953 | 331 |

**Note on class weights:** The `class_weight` strategy was chosen over `no_handling` (the validation macro-F1 winner) because it significantly improves recall on the Bot family, keeping performance balanced across attacks.


### Joint Budget Trade-off

To keep the full system within the false-alert budget, the classifier threshold and detector flag rate must be balanced.

| Detector flag rate | Classifier threshold | Classifier TPR | Novel recall |
| --- | --- | --- | --- |
| 0.00% | 0.0047 | 99.89% | 0.00% |
| 0.10% | 1.0000 | 96.02% | 0.00% |
| 0.20% | 1.0000 | 79.77% | 0.00% |
| 0.30% | 1.0000 | 71.17% | 0.00% |
| 0.40% | 1.0000 | 64.86% | 0.00% |
| 0.50% | — | 0.00% | 0.00% |
| 1.00% | — | 0.00% | 100.00% |

### Attacks it was never trained on

Leave-one-family-out: each family is removed from training entirely, a fresh model is trained, and the held-out family is replayed at it. Each run sets its own threshold from the same budget.

| Held-out family | Flows | Classifier alone | Detector alone | Full system | Benign FPR |
| --- | ---: | ---: | ---: | ---: | ---: |
| PortScan | 23,771 | 3.5% | 0.4% | 3.6% | 1.38% |
| BruteForce | 1,254 | 0.5% | 0.0% | 0.5% | 1.11% |
| WebAttack | — | — | — | — | no test rows for this family |
| Bot | 331 | 0.0% | 1.8% | 1.8% | 1.13% |

Families withheld from training altogether (Infiltration, 2 test flows): 100.0% raised an alert, and **100.0% were shown to the analyst as Unknown** rather than under a known family's name.

## Failure modes

Observed on the test set, most severe first.

- **Novel attacks that look like normal traffic are missed.** Held out of training, BruteForce is caught only 0.5% of the time: it sits close enough to benign traffic that neither model separates it.
- **Bot is the weakest known family**, at 0.973 recall.
- **Benign and DoS are confused with each other.** 80 Benign flows were labelled DoS, and 8 the other way.
- **False alerts on benign traffic concentrate on DoS**: 80 of 212 (38%) were labelled DoS.
- **Some novel attacks keep a confident wrong name.** 0.0% of never-trained-on flows are still reported under a known family's label.
- **The out-of-family check has a cost.** It relabels 0.9% of correct alerts on known families as Unknown (73,804 alerts measured), and 6 benign flows.
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
| Time blocks (honest) | 0.979 | 9.0 | 0% |
| Random rows (naive) | 0.4391 (0.4391–0.95 over 5 seeds) | 4523.6 | 100% |

**No inflation was measured.** Every random split scored at or below the honest one, although 100% of its test flows came from time blocks also used in training.
 The synthetic generator's bursts carry independent noise per flow, so they are not near-duplicates and there is little to memorise. This has to be re-measured on CICIDS2017, where flows inside one attack burst are expected to be near-identical; a test with deliberately leaky data (`tests/test_naive_split.py`) shows the comparison does detect inflation when it exists.

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

