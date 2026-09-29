# NetWatch — Drift monitoring strategy

## What is tracked

| Signal | How | When |
|---|---|---|
| Feature distribution shift | Population Stability Index (PSI) per feature | Every 5,000 benign-looking flows |
| Feature distribution shift | KS statistic, top 15 features by KS (reported in `ks`, not used in the status) | Every drift window |
| Unexplained alert rate | Share of Unknown alerts among flows the classifier did **not** name as a known attack, rolling over the last 5,000 such flows | Continuously |
| Alert rate | Share of all flows that alerted (reported, not used in the status) | Continuously |
| Analyst feedback | Share of alerts marked false_positive | Per session (not yet in the status) |

PSI bins come from 10 quantile edges computed on benign validation traffic at
training time and saved to `models/v1/reference_stats.json`.
Only flows that did **not** alert are counted, so a busy attack hour does not
read as distribution drift.

The alert-rate **baseline** is measured by `make train`: benign validation flows
go through the same decision the API makes, and the share raised as Unknown is
saved to `models/v1/thresholds.json` as `benign_unexplained_alert_rate`. It is
about 1%, because the anomaly detector is calibrated to flag 1% of benign
traffic. (An earlier version compared against the 0.5% FPR budget, so ordinary
traffic already read as "drift".)

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
