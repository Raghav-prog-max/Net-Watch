# Model card — NetWatch v1

Generated from `reports/metrics.json` (2026-09-30T09:58:46Z) by `python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.

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

Macro-F1 **0.916** across benign and 6 attack families.

**False alerts: 44.7 per 10,000 benign flows** (0.45%) for the full system on the test set, within the 0.5% budget (50 per 10,000). The budget is split between the two models, both cut-offs chosen on validation: 41.1 come from the classifier, whose threshold (0.9939) keeps it within 0.40%; 3.6 come from the anomaly detector alone, calibrated to flag 0.10% of benign traffic. An alert from either model reaches the analyst.

No accuracy figure is reported: about 80% of traffic is benign, so a model that never alerts would score about 80%.

| Class | Precision | Recall | F1 | PR-AUC | Test flows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Benign | 0.995 | 0.996 | 0.996 | 1.000 | 5,598 |
| PortScan | 1.000 | 1.000 | 1.000 | 1.000 | 897 |
| BruteForce | 0.931 | 0.975 | 0.953 | 0.990 | 360 |
| DoS | 0.883 | 0.898 | 0.891 | 0.963 | 1,121 |
| WebAttack | 0.934 | 0.867 | 0.899 | 0.956 | 211 |
| DDoS | 0.869 | 0.854 | 0.861 | 0.951 | 848 |
| Bot | 0.835 | 0.790 | 0.812 | 0.852 | 186 |

### Attacks it was never trained on

Leave-one-family-out: each family is removed from training entirely, a fresh model is trained, and the held-out family is replayed at it. Each run sets its own threshold from the same budget.

| Held-out family | Flows | Classifier alone | Detector alone | Full system | Benign FPR |
| --- | ---: | ---: | ---: | ---: | ---: |
| PortScan | 897 | 0.0% | 95.0% | 95.0% | 0.43% |
| BruteForce | 360 | 100.0% | 0.0% | 100.0% | 0.43% |
| WebAttack | 211 | 100.0% | 66.8% | 100.0% | 0.45% |
| Bot | 186 | 15.6% | 0.0% | 15.6% | 0.07% |

Families withheld from training altogether (Heartbleed, Infiltration, 103 test flows): 100.0% raised an alert, and **93.2% were shown to the analyst as Unknown** rather than under a known family's name.

### Splitting the false-alert budget between the two models

The same models at other cut-offs, both chosen on validation; nothing is retrained. The first row is the configuration in use (`train.classifier_fpr_budget` and `anomaly.benign_flag_rate` in `ml/config.yaml`). Each row trades false alerts against catching attacks the classifier has never seen.

| Classifier budget | Detector flag rate | False alerts / 10k (val) | False alerts / 10k (test) | Macro-F1 | Never-trained families alerted | LOFO PortScan | LOFO BruteForce | LOFO WebAttack | LOFO Bot | 
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | 
| 0.40% (in use) | 0.10% | 49.7 | 44.7 | 0.916 | 100.0% | 95.0% | 100.0% | 100.0% | 15.6% | 
| 0.50% | off | 49.7 | 42.9 | 0.917 | 100.0% | 0.0% | 100.0% | 100.0% | 15.6% | 
| 0.25% | 0.25% | 49.7 | 58.9 (over) | 0.914 | 100.0% | 97.7% | 100.0% | 100.0% | 15.6% | 
| 0.10% | 0.40% | 49.7 | 42.9 | 0.903 | 100.0% | 98.4% | 100.0% | 99.1% | 15.6% | 
| 0.50% (before 30 Sep) | 1.00% | 149.0 | 109.0 (over) | 0.917 | 100.0% | 99.7% | 100.0% | 100.0% | 17.7% | 

## Failure modes

Observed on the test set, most severe first.

- **Novel attacks that look like normal traffic are missed.** Held out of training, Bot is caught only 15.6% of the time: it sits close enough to benign traffic that neither model separates it.
- **Bot is also the weakest known family**, at 0.790 recall.
- **DDoS and DoS are confused with each other.** 124 DDoS flows were labelled DoS, and 109 the other way.
- **Every false alert on benign traffic was labelled Bot** (all 23).
- **Some novel attacks keep a confident wrong name.** 6.8% of never-trained-on flows are still reported under a known family's label.
- **The out-of-family check has a cost.** It relabels 0.9% of correct alerts on known families as Unknown (3,596 alerts measured); no benign flow was relabelled.
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
| Time blocks (honest) | 0.9159 | 41.1 | 0% |
| Random rows (naive) | 0.9047 (0.9023–0.9118 over 5 seeds) | 42.6 | 100% |

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

**Not yet built:** tracking the share of alerts analysts mark as false positives.

## Reproducing these numbers

```bash
make data                        # raw CSVs -> data/processed/flows.pkl
make train                       # both models, thresholds, LOFO -> reports/metrics.json
python -m ml.evaluate.model_card # this card
```

