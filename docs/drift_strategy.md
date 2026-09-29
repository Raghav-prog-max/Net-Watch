# NetWatch — Drift monitoring strategy

## What is tracked

| Signal | How | When |
|---|---|---|
| Feature distribution shift | Population Stability Index (PSI) per feature | Every 5,000 benign-looking flows |
| Feature distribution shift | KS test on top 15 features by importance | Every drift window |
| Alert rate | Rolling mean over the drift window | Continuously |
| Analyst feedback | Share of alerts marked false_positive | Per session |

PSI bins come from 10 quantile edges computed on benign validation traffic at
training time and saved to `models/v1/reference_stats.json`.
Only flows that did **not** alert are counted, so a busy attack hour does not
read as distribution drift.

## Status rules

| Status | Condition |
|---|---|
| Stable | All features PSI < 0.1 AND alert rate < 1.5x baseline |
| Warning | Any feature PSI 0.1–0.25 OR alert rate 1.5–2x baseline |
| Drift | 3+ features PSI > 0.25 OR alert rate > 2x baseline |

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
