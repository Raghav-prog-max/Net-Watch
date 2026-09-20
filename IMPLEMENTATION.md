# Implementation order

Each step lists what to build, who owns it, and how you know it is done. Do not
start a step before its predecessor's check passes.

## Step 0 — Repo running on every machine (day 1, everyone)
- `pip install -r requirements.txt`, then `make synthetic && make data && make quick`.
- **Done when:** every team member has `reports/metrics.json` on their own machine.
- Synthetic data exists so nobody is blocked on the download. Never report its numbers.

## Step 1 — Real data (day 1–2, data owner)
- Download the CICIDS2017 CSVs with timestamps into `data/raw/`.
- Run `make data`. Confirm the family counts printed match the published dataset.
- **Done when:** `data/processed/flows.pkl` exists and `make test` passes.

## Step 2 — Baseline and honest splits (day 2–3, ML lead + data owner)
- `make train`. Read `reports/metrics.json`: per-class recall, FPR, threshold.
- Add a random-split run for comparison (change `make_splits` to `train_test_split`
  in a scratch script, never in `ml/`), and record both numbers.
- **Done when:** you can state the gap between the naive and honest split out loud.

## Step 3 — Anomaly detector and LOFO (day 3–5, anomaly owner)
- Tune `benign_flag_rate` in `ml/config.yaml` until benign FPR is acceptable.
- Run the full `make train` including LOFO; fill the table in the deck.
- **Done when:** `reports/metrics.json` has a `lofo` block with real numbers and
  `novel_families.caught_by_anomaly_detector` is above zero.

## Step 4 — Service (day 4–6, backend)
- `make api`, then `python replay/replayer.py --scenario known`.
- **Done when:** alerts appear in `data/alerts.db` and `/alerts` returns them sorted
  by severity.

## Step 5 — Dashboard (day 3–8, frontend)
- Build against the schemas in `api/schemas.py` with mock JSON from day 3.
- Switch to the live API by pointing `NEXT_PUBLIC_API_URL` at port 8000.
- **Done when:** the live feed updates over `/ws/alerts` without a page refresh.

## Step 6 — Drift (day 8–10, MLOps)
- `python replay/replayer.py --scenario drift`, then poll `/metrics/drift`.
- **Done when:** the status moves from `stable` to `drift` during that replay and the
  top drifting features are named.

## Step 7 — Feedback loop and v2 (day 10–12, ML lead + backend)
- Mark alerts false positive via `PATCH /alerts/{id}`.
- Retrain including those labels, write to `models/v2`, compare on the same test set.
- **Done when:** v2 is promoted only because it beat v1, or explicitly rejected.

## Step 8 — Freeze (day 12–14, everyone)
- Fill `models/MODEL_CARD_TEMPLATE.md` from `reports/metrics.json`.
- Record the backup demo video. Rehearse twice against the day-14 script.

## Known shortcuts to remove before judging
- `benign_downsample` is 0.20 by default. Say so if asked; it affects FPR.
- `shap` and `lightgbm` have fallbacks. Install both before the final run so the
  explanations and the classifier match what you present.

## Notes from the first end-to-end run

- `python -m ml.train --holdout WebAttack` writes `models/v1-without-webattack/`.
  Point the API at it (`Scorer("models/v1-without-webattack")`) for the novel-attack
  moment in the demo, and keep `models/v1` for every reported number.
- Out-of-distribution flows often get a confident but wrong family label from the
  classifier. The alert carries `also_abnormal: true` when the detector disagrees,
  which is the honest way to present "we caught it, we may have named it wrong".
- Low-volume, low-rate attacks (PortScan-like) can sit inside the benign density and
  escape an Isolation Forest at a 1% flag rate. Raising `benign_flag_rate` buys recall
  and costs false alerts. Record the trade-off; do not hide the miss.
- Drift is measured only on flows the system considers benign, so a busy attack hour
  does not read as distribution drift.
