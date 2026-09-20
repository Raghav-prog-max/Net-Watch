# Code tour

Read in this order. Each file does one job, and the interesting decisions are the ones
that stop the model looking better than it is.

## ml/data/labels.py
Fifteen raw labels collapse into seven families. `TRAIN_FAMILIES` is what the classifier
may learn. `NOVEL_ONLY` (Infiltration, Heartbleed) is deliberately excluded from
training: with 36 and 11 flows, no resampling makes them learnable, so they become test
material for the anomaly detector. `LOFO_FAMILIES` is the list removed one at a time in
the leave-one-family-out experiment.

## ml/data/clean.py
Six steps, in a fixed order. The one that matters for credibility is step 2: flow IDs,
IP addresses and source ports are dropped before training. Leave them in and the model
learns "traffic from 172.16.0.1 is an attack", which scores brilliantly and generalises
to nothing.

## ml/data/split.py
`add_blocks` stamps every flow with `day + 5-minute bucket`; `make_splits` uses
`GroupShuffleSplit` on that column. Flows inside one attack burst are near-duplicates,
so a random split scatters copies across train and test. `tests/test_split_leakage.py`
fails the build if a block ends up in two splits. `downsample_benign` touches the
training set only, never validation or test.

## ml/models/classifier.py
LightGBM when installed, `HistGradientBoostingClassifier` otherwise, Random Forest as a
declared baseline; all three carry class weights. `attack_score` returns `1 − P(Benign)`
rather than the argmax, because the alert decision is "is this worth an analyst's time",
not "which family is most likely". `predicted_family` then names the most likely
attack, ignoring the benign column.

## ml/models/anomaly.py
Isolation Forest fitted on benign training flows only, so it never sees an attack.
`calibrate` sets the cut-off from benign *validation* traffic at a chosen flag rate,
which is how the false-alarm cost stays a decision rather than an accident.
`percentile` places a score inside the benign distribution and feeds the severity score.

## ml/models/combine.py
The decision table. Classifier above threshold, or detector says abnormal, and an alert
is written; otherwise nothing happens. When the classifier names a family *and* the
detector disagrees, the alert carries `also_abnormal: true` — often a variant of a known
family, or something new wearing familiar clothes. Severity mixes confidence, anomaly
percentile and a per-family weight. MITRE tactic and a suggested action are attached
here. Nothing in this file, or anywhere else, blocks traffic.

## ml/evaluate/thresholds.py
Walks the ROC curve and takes the highest recall available inside the false-positive
budget from `config.yaml`. This is the difference between "99% accurate" and "50 false
alerts per 10,000 benign flows", which is the number a SOC lead actually asks for.

## ml/evaluate/metrics.py
Per-class precision and recall, macro-F1, PR-AUC and ROC-AUC one-vs-rest, the confusion
matrix, and the false-positive rate expressed per 10,000 flows. Accuracy is present,
named `accuracy_for_reference_only`, so nobody quotes it by accident.

## ml/evaluate/lofo.py
For each family: drop it from train and val, retrain both models, then measure how much
of it the classifier catches alone versus the classifier plus the detector. This is the
experiment that answers the problem statement's headline claim.

## ml/drift/monitor.py
Quantile bin edges saved at training time, PSI per feature at inference, a status of
stable / warning / drift, and a recommendation. It recommends retraining; it never
retrains.

## ml/train.py
The one entry point. Loads, splits, downsamples benign in train, fits the classifier and
the baseline, picks the threshold on validation, fits and calibrates the detector,
evaluates on test, runs LOFO, then writes `models/v1/` and `reports/metrics.json`.
`--holdout WebAttack` trains a demo model without that family so "Unknown / novel"
appears on stage; `--skip-lofo` is for fast iteration.

## api/scorer.py
Loads the artefacts once, scores batches, attaches explanations, and keeps a rolling
window for drift. The window holds only flows that produced no alert, so an attack burst
does not masquerade as distribution drift.

## api/main.py
Eight endpoints and a WebSocket, matching `api/schemas.py`. `POST /score` stores alerts
and broadcasts them; `PATCH /alerts/{id}` records triage, which is the training data for
the next model.

## replay/replayer.py
Streams held-out flows at the API at a chosen rate. `--scenario` picks normal, known,
novel or drift. The drift scenario shifts a few features on benign traffic gently, so the
detector stays quiet while the monitor notices the move — drift, not an attack.

## dashboard/
Next.js app router. `lib/types.ts` mirrors `api/schemas.py`; change them in the same PR.
Pages: live feed with WebSocket updates, alert detail with triage, evaluation, drift,
models.
