# NetWatch — Drift monitoring strategy

## What is tracked

| Signal | How | When |
|---|---|---|
| Feature distribution shift | Population Stability Index (PSI) per feature | Every 5,000 benign-looking flows |
| Feature distribution shift | KS statistic on the classifier's 15 most important features (reported in `ks`, not used in the status) | Every drift window |
| Unexplained alert rate | Share of Unknown alerts among flows the classifier did **not** name as a known attack, rolling over the last 5,000 such flows | Continuously |
| Alert rate | Share of all flows that alerted (reported, not used in the status) | Continuously |
| Predicted family mix | Share of each family among alerts over the same window (`family_mix`) | Continuously |
| Analyst feedback | Share of the last 500 alerts marked false_positive (`fp_share`; untriaged alerts count in the denominator) | On every request (not used in the status) |
| History | One snapshot every 1,000 flows scored, last 100 kept (`history`: status, max PSI, alert rates, family mix) | Continuously |

All thresholds and sizes are read from `drift:` in `ml/config.yaml`.

The drift set (handbook: "a held-out day, plus a perturbed copy of test with scaled
packet sizes and stretched durations, to trigger the drift monitor on demand") is two
replayer scenarios. `--scenario drift` takes the test split's benign flows and scales
their packet sizes and stretches their durations by the same factor, so packets per
second fall and bytes per second stay put; the factor climbs to a 1.2x hold, then to
3x, so the status walks stable -> warning -> drift. `--scenario day` replays the day
`make train` held out (`data/splits/drift.pkl`, CICIDS2017's Monday) unchanged.

PSI bins come from 10 quantile edges computed on benign validation traffic at
training time and saved to `models/v1/reference_stats.json`. The two outer bins
are open-ended: a flow below the lowest edge or above the highest counts in the
first or last bin, so traffic that moves past anything seen in training raises
PSI instead of dropping out of the count (`bin_counts` in `ml/drift/monitor.py`).
Only flows that did **not** alert are counted, so a busy attack hour does not
read as distribution drift.

The alert-rate **baseline** is measured by `make train`: benign validation flows
go through the same decision the API makes, and the share raised as Unknown is
saved to `models/v1/thresholds.json` as `benign_unexplained_alert_rate`. It is
about 0.1%, because the anomaly detector is calibrated to flag 0.1% of benign
traffic (its share of the 0.5% false-alert budget). An earlier version compared
against the 0.5% FPR budget, so ordinary traffic already read as "drift".

## Status rules

| Status | Condition |
|---|---|
| Stable | All features PSI < 0.1 AND unexplained alert rate < 1.5x baseline |
| Warning | Any feature PSI 0.1–0.25, OR unexplained alert rate ≥ 1.5x baseline |
| Drift | 3+ features PSI > 0.25, OR unexplained alert rate ≥ 2x baseline **while PSI is at least Warning** |

One deviation from the handbook: the alert rate alone can raise Warning but not
Drift. A novel-attack burst also raises the unexplained rate, and that is an
incident for the analyst, not a changed network; declaring drift then would
recommend retraining on an attack. When features have moved as well, the rate
rule applies as the handbook describes.

## Retraining path

1. Dashboard shows Drift status and lists the top drifting features.
2. Build a new training set: original training data **plus** analyst-labelled alerts.
3. Train v2 using `make train` (same settings, same splits).
4. Evaluate v2 on the same test and LOFO sets as v1.
5. Promote v2 only if macro-F1 improves **and** FPR stays within the 0.5% budget.
6. Keep v1 for rollback; do not delete it.

A person approves every model change. Nothing retrains automatically.

## PSI formula

`
PSI = sum((actual_i - expected_i) * ln(actual_i / expected_i))
`

where expected and actual are normalised bin counts (+ epsilon to avoid log(0)).
