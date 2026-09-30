# NetWatch — Handbook Gap Audit
Sep 30, 2026 · @Someone

## Summary
On a fresh clone of main (fabc624) the whole system builds, trains, tests and runs as the handbook describes. But the false-alert rate we report is not the rate an analyst will see. The headline figure (42.9 false alerts per 10,000 benign flows, "within the 0.5% budget") counts the classifier only. The full system also alerts when the anomaly detector flags a flow. Measured end to end, it raises 109.0 per 10,000 (1.09%), about 2.2 times the budget. A live replay of normal traffic confirmed it: 32 alerts in 3,000 benign flows.

Everything else is either verified or a smaller, fixable gap:
* **Reproducible**: `make data`, `make train`, `make evaluate` rebuilt every number exactly (macro-F1 0.9166). All 219 tests pass.
* **Demo behaviour works live**: normal traffic is stable; novel attacks show as Unknown; the drift scenario turns the badge to drift; triage and false-positive feedback work.
* **25 gaps in total**: 1 critical (above), 2 blocked on data (CICIDS2017, NSL-KDD), and 22 smaller gaps in evaluation, drift, API, docs and pitch readiness.

**All numbers are synthetic.** The real CICIDS2017 files are still not downloaded, so no figure in this audit may be quoted as a result.

**Do first**: fix how the false-alert rate is measured and budgeted (gap 1), then download CICIDS2017 and rerun everything.

## How the audit was done
The spec is the [NetWatch Project Handbook](https://claude.ai/artifact/7x7Di1rRc1qiGGU3Gzkmdk); its Definition of Done is the checklist.
* Cloned [Raghav-prog-max/Net-Watch](https://github.com/Raghav-prog-max/Net-Watch) fresh at fabc624 (after PR #12) into a new folder, with a new virtual environment (Python 3.13) and only `requirements.txt` installed.
* Ran the pipeline from scratch: synthetic data (60,000 flows), `ml.prepare`, `ml.train` (includes LOFO, naive split, imbalance study), `ml.evaluate.model_card`, then the full test suite.
* Read the code for each handbook section: repository layout, data plan, ML pipeline, evaluation, drift, API contract, dashboard, Definition of Done.
* Ran the API live and replayed each demo scenario (normal, known, novel, drift; 3,000 flows each) against a fresh database, then read `/metrics/drift` and `/alerts`.
* Tested triage (`PATCH /alerts/{id}`), an invalid status value, `/models`, `/metrics/model` and the `/ws/alerts` WebSocket.
* Measured the benign false-alert rate of the classifier alone, the detector alone, and the full system on the test split.
* Not covered this pass: `docker compose up` (CI builds the image on every PR), the dashboard in a browser (frontend work is paused), and anything needing CICIDS2017.

## Definition of Done scorecard
7 of the 14 items are met, 4 are partly met, 2 are not met, and 1 was not verified this pass.

| DoD item | Status | Evidence |
| :--- | :--- | :--- |
| docker compose up starts everything | Not verified | Not run this pass. CI builds the API image and checks it imports on every PR; compose ran on a clean clone on 29 Sep. |
| make train and make evaluate reproduce every number | Partly met | Reproduced exactly on a fresh clone (macro-F1 0.9166, 42.9/10k). Partly: the data is synthetic, and some Models-page figures are typed into api/routes/metrics.py (gap 8). |
| Leakage test passes | Met | tests/test_split_leakage.py passes; no time block appears in two splits. |
| No bare accuracy anywhere | Met | Accuracy appears only as accuracy_for_reference_only and in docs that explain why it is not used. |
| Per-class metrics, PR-AUC, FPR on dashboard | Partly met | Evaluation page shows per-class metrics, PR-AUC and false alerts/10k. Partly: that FPR is classifier-only (gap 1). |
| LOFO table filled in | Met | Model card: PortScan, BruteForce, WebAttack, Bot, plus Infiltration and Heartbleed (never trained). |
| Novel attack shows as Unknown in the demo | Met | Live novel replay: 92 of the first 100 alerts shown as Unknown. |
| Every alert has severity, reasons, MITRE mapping | Met | Checked on every alert returned in all four live scenarios. |
| Triage and false-positive feedback work | Partly met | PATCH to false_positive works and retraining uses it. Partly: any status string is accepted (gap 13), and the drift monitor ignores the FP share (gap 9). |
| Drift badge changes in the drift scenario | Met | Live: normal = stable; drift scenario = drift (PSI status drift). |
| No code path blocks traffic | Met | No blocking, dropping or firewall code anywhere in api/, ml/, replay/, scripts/. |
| Model card and limitations written | Partly met | Generated card with limitations and failure modes, labelled synthetic. Partly: it states the classifier-only FPR as "within budget" (gap 1). |
| Backup demo video recorded | Not met | Not recorded (handbook task t32). |
| Pitch rehearsed under time | Not met | Not done yet; team task. |

## Critical gap: the false-alert rate we report is not what analysts see
* **What is wrong.** `ml/models/combine.decide` raises an alert when the classifier's attack score passes the threshold *or* the anomaly detector flags the flow. But `ml/train.py` builds the headline main report from the classifier alone (attack_score >= threshold). The detector's own flag rate is set separately (`anomaly.benign_flag_rate`, about 1% of benign validation) and never counted against the 0.5% budget. The two sources barely overlap, so their rates almost add up.
* **Live confirmation.** Replaying 3,000 normal flows through the running API produced 32 alerts (1.07%), matching the 1.09% measured offline.
* **Where the wrong number shows:** `reports/metrics.json` (main), the model card ("42.9 false alerts per 10,000 benign flows (0.43%), within budget"), the dashboard Evaluation page, and the deck and video. The LOFO table's "Benign FPR" column already shows the full-system rate (0.88–1.32%), so the report disagrees with itself.

### Fix options
1. **Report both, lead with the system rate (recommended now).** Add a system block to the report: benign false alerts of the full decision logic, per 10,000. Show it first on the model card and dashboard; keep the classifier-only figure as a component. Small change, fully honest.
2. **Budget the whole system (experiment).** Choose the classifier threshold and the detector flag rate together so their union stays within 0.5% on validation. It will cost novel-attack recall; publish the trade-off table, as the handbook's risk plan says ("raise its threshold and show the recall/FPR trade-off openly").
3. **Change the budget on purpose.** If the team prefers the current recall, state a 1.1% budget and justify it in the model card and pitch. Do not keep 0.5% in the text.
The judge question "How many false alerts will analysts face?" has to be answered with the system number.

**Status (30 Sep): option 1 is in PR #14.** The report, model card and dashboard now lead with the full-system figure, and the model card prints the budget trade-off. On synthetic data, splitting the budget as classifier 0.4% and detector 0.1% gives 44.7 false alerts per 10k (within budget), macro-F1 0.916 and PortScan LOFO 95.0%. Switching the detector off drops PortScan LOFO to 0%. **The team chose 0.4% + 0.1% on 30 Sep; it is in the same PR.** The full system now gives 44.7 false alerts per 10k, and live normal traffic produced 11 alerts in 3,000 flows (down from 32).

## All gaps
25 gaps: 1 critical, 4 high, 9 medium, 11 low. Numbers match the chat list; handbook references are to its section names.

| # | Area | Gap | Evidence | Handbook | Severity | Suggested fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Evaluation | Reported false-alert rate is classifier-only | 42.9/10k reported; full system 109.0/10k; live 32 alerts in 3,000 normal flows | Evaluation item 2; ML pipeline "Threshold for an alert budget" | Critical | See the critical-gap section |
| 2 | Data | CICIDS2017 not downloaded; every number is synthetic | data/raw/ holds only synthetic output; model card carries the warning | Data plan; t1 | High | User places kaggle.json; rerun make data train evaluate |
| 3 | Data | NSL-KDD check not run | scripts/nslkdd_check.py exits 2: files missing; the UNB page says the dataset is no longer available | Data plan; t4 | Medium | Pick a source; run make nslkdd |
| 4 | ML | Chosen imbalance strategy is not the validation winner | Val macro-F1: no handling 0.9088, undersample 0.9088, SMOTE 0.9015, class_weight (chosen) 0.8993 | ML pipeline "Imbalance experiments": keep the winner | Medium | Team decides; if class_weight stays for Bot recall, say why in the model card |
| 5 | ML | SMOTE applied to the whole training split, not inside folds | ml/train.py calls SMOTE.fit_resample(X_train, …) | "SMOTE inside training folds via imblearn.pipeline" | Low | Wrap in imblearn.pipeline with CV, or note that val is untouched |
| 6 | Drift | KS test ranks features by KS statistic, not importance | ml/drift/monitor.py ks_test sorts by ks_stat | "KS test on the top 15 features by importance" | Low | Save classifier importances at train time; test those 15 |
| 7 | Data | Drift set is a synthetic ramp only; splits are not saved | No held-out day; no data/splits/ | Data plan "Drift set"; repo layout | Medium | With CICIDS2017, hold out one day; write split files |
| 8 | Evaluation | Hand-typed figures on the Models page | VERSION_HISTORY in api/routes/metrics.py (e.g. "PortScan LOFO 0.0% → 99.7%") | Evaluation: "No hand-copied numbers" | Medium | Generate from reports/ per release, or label as historical synthetic runs |
| 9 | Drift | Analyst false-positive share not tracked | status() accepts fp_share; the scorer never passes it | Drift "Share of analyst-marked false positives" | Medium | Compute from the alert store; show in /metrics/drift |
| 10 | Drift | Predicted family mix not tracked over time | No family counts per window | Drift "Alert rate and predicted family mix over time" | Low | Keep per-window family counts in the scorer |
| 11 | Drift | /metrics/drift returns no history | Dashboard builds history in the browser while the page is open | API contract "Current drift status and history" | Medium | Store one snapshot per window; return the last N |
| 12 | Drift | Dead module | api/services/drift_service.py is imported nowhere | Repo layout | Low | Route /metrics/drift through it or delete it |
| 13 | API | Any triage status accepted | Live: PATCH with totally_made_up returned 200 and was saved | API contract status flow | Medium | Literal of the 5 statuses in Feedback; 422 otherwise |
| 14 | API | Two MITRE maps that disagree | ml/models/combine.MITRE vs api/services/mitre.py (DoS T1499 vs T1498/T1499; PortScan) | API contract MITRE table | Medium | One map, used by both |
| 15 | API | WebSocket keeps dead connections | broadcast swallows send errors and never removes the socket | t18 WebSocket broadcast | Low | Drop a connection when a send fails |
| 16 | API | /alerts filters in Python after loading every row | query.all() before severity/family filters | API contract /alerts | Low | Filter in SQL (JSON columns or plain columns) |
| 17 | Config | Same settings under two names | window/window_size, bins/n_bins, warn_psi/psi_warning in ml/config.yaml | Repo layout: one config | Low | Keep one schema; update readers |
| 18 | Frontend | Drift page overrides the API's status | app/drift/page.tsx calls it drift when one feature has PSI ≥ 0.25 | Drift rule: 3+ features | Medium | Show the API's status field only (frontend paused) |
| 19 | Frontend | Some must-have details not verified | Alerts-per-minute chart, feedback counter, mobile check | SOC dashboard table; t31 | Low | Check when frontend work resumes |
| 20 | Pitch | Backup demo video not recorded | No file | DoD; t32 | High | Record after the gap-1 fix |
| 21 | Pitch | Deck and video show old numbers | e.g. PortScan LOFO 0% | Evaluation "No hand-copied numbers" | High | Refresh from reports/ after real data |
| 22 | Pitch | Pitch not rehearsed under time | Team task | DoD; t34–t35 | High | Two timed runs |
| 23 | Process | PRs merge without a second reviewer | Branch protection requires checks, not reviews | Repo "merge through a short PR reviewed by one other person" | Low | Require 1 approving review on main |
| 24 | Frontend | Empty and error states not checked this pass | Not verified | t31 | Low | Check when frontend work resumes |
| 25 | Docs | Team roles still letters | Handbook table uses A–F | Team roles: "replace them with names" | Low | Fill in the six names |

Found while fixing gap 1 (gap 26, low): `scripts/dashboard_snapshot.py` and `make dashboard-snapshot` fail, because they write into `dashboard/lib/mockData.ts`, which PR #8 removed. The dashboard no longer has an offline fallback, so the script is dead. Delete it and its Makefile target, or restore a fallback.

## Progress (30 Sep):
* **Gap 1 is fixed and merged in PR #14**: the full-system false-alert rate is now 44.7 per 10k, with the budget split 0.4% classifier and 0.1% detector.
* **Gap 3 is done**: NSL-KDD was downloaded from the Jehuty4949/NSL_KDD mirror, and every metric agreed with its independent recomputation on both test sets. The results are recorded in PR #15.
* **Gaps 13–16 and 26 (API hardening) are in PR #16**: only the five handbook statuses are accepted, there is one MITRE map, `/alerts` filters in SQL, dead WebSockets are dropped, and the broken snapshot script is removed.
* **Gaps 6, 9–12 and 17 (drift and config) are in PR #17**, which is stacked on #16: KS runs on the most important features, and `/metrics/drift` gains the false-positive share, family mix and history. The config now has one key per setting, and the scorer reads its drift thresholds from the config.

## What matches the handbook
These were checked in code and, where marked, live on the fresh clone.
* **Repository layout**: `ml/` (data, features, models, evaluate, explain, drift), `api/` (routes, services, db, schemas), `replay/`, `dashboard/`, `docs/`, `tests/`, as specified.
* **Leakage-free splits**: 5-minute time blocks, 70/15/15, with a unit test that fails the build if a block appears in two splits.
* **Models**: Random Forest baseline (300 trees, balanced_subsample) and LightGBM main classifier; Isolation Forest (200 trees, contamination="auto") fitted on benign training rows only, on log-scaled features.
* **Decision logic and severity**: the handbook's formula and weights exactly; levels Critical ≥ 85, High ≥ 65, Medium ≥ 40. An out-of-family check adds Unknown for confident but wrong labels.
* **Threshold**: chosen on validation from the 0.5% budget and saved in `models/v1/thresholds.json` (for the classifier; see gap 1).
* **Evaluation report**: per-class precision/recall/F1, macro-F1, PR-AUC and ROC-AUC, row-normalised confusion matrix, RF vs LightGBM, all four imbalance strategies, LOFO table, naive vs honest split, limitations. Generated by `make train` / `make evaluate`; reproduced exactly.
* **Novel attacks (live)**: Infiltration and Heartbleed are never trained on; the novel replay shows them as Unknown.
* **Drift (live)**: PSI per feature every 5,000 flows with training-quantile bins, KS on 15 features, alert-rate rule; normal = stable, drift scenario = drift.
* **Alerts (live)**: every alert carries severity, SHAP reasons, MITRE mapping and a recommended action; no code path blocks traffic.
* **Retraining path**: analyst labels become training rows, v2 is scored on v1's test and LOFO sets, and promotion needs better macro-F1 within budget and a human decision.
* **Engineering**: 219 tests pass; CI runs the pipeline, the dashboard build and the Docker image on every PR; the EDA notebook (t5) and the metrics cross-check (t4 code) are merged.

## Recommended fix plan
Six pull requests, in this order. The first two change the numbers everything else quotes, so the video and deck wait for them. Owners use the handbook's role letters.

| Order | Pull request | Gaps | Owner | Unblocks |
| :--- | :--- | :--- | :--- | :--- |
| 1 | System-level false-alert rate: add it to reports/metrics.json, lead with it in the model card and on the Evaluation page; run the joint-budget experiment and publish the trade-off | 1, 8 | A (ML lead) with C | Honest answer to "how many false alerts"; the video and deck |
| 2 | Real data: download CICIDS2017 (user's kaggle.json), hold out one day for drift, save split files, rerun everything; run NSL-KDD once a source is chosen | 2, 3, 7 | C (data and evaluation) | Every quotable number; the naive-vs-honest claim |
| 3 | Imbalance decision: pick the strategy on the real validation set; move SMOTE inside folds | 4, 5 | C with A | Model card "why this strategy" line |
| 4 | Drift completeness: FP share, family mix, stored history in /metrics/drift, KS on the top 15 by importance, remove or use drift_service.py, single config schema | 6, 9–12, 17 | F (MLOps) | Drift page and demo step 6 |
| 5 | API hardening: validate the status flow, one MITRE map, drop dead WebSocket connections, filter /alerts in SQL | 13–16 | D (backend) | Triage demo step 4 |
| 6 | Pitch readiness: refresh the deck, record the backup video, two timed rehearsals, require one reviewer on main, names in the roles table | 20–23, 25 | F with R | Definition of Done |

Frontend items 18, 19 and 24 wait until frontend work resumes.

## Appendix

### Reproduced numbers (fresh clone, synthetic data)
| Figure | Value |
| :--- | :--- |
| Macro-F1, time-block test split | 0.9166 |
| Classifier-only false alerts per 10k benign | 42.9 |
| Full-system false alerts per 10k benign | 109.0 |
| Naive random split macro-F1 (5 seeds) | 0.9045 (0.9025–0.9111); no inflation on synthetic data |
| Imbalance study, val macro-F1 | none 0.9088 · undersample 0.9088 · SMOTE 0.9015 · class_weight 0.8993 |
| Training time | 2 min 15 s |
| Tests | 219 passed |

### Live replay (3,000 flows per scenario, fresh database each)
| Scenario | Drift status | Alerts | Top alert families (first 100) |
| :--- | :--- | :--- | :--- |
| normal | stable | 32 | Unknown 24, Bot 8 |
| known | warming up | 3,000 | DoS 39, DDoS 32, PortScan 28 |
| novel | warming up | 600 (all novel flows) | Unknown 92, DDoS 8 |
| drift | drift | 228 | Unknown 60, Bot 40 |

Drift stays "warming up" in the known and novel runs because the monitor only measures traffic the system treats as benign, and those replays contain almost none. That is by design, but the dashboard should say so rather than look stuck.

### Reproduce the audit
```bash
git clone https://github.com/Raghav-prog-max/Net-Watch.git && cd Net-Watch
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python scripts/make_synthetic.py --rows 60000
.venv/Scripts/python -m ml.prepare --config ml/config.yaml
.venv/Scripts/python -m ml.train --config ml/config.yaml
.venv/Scripts/python -m ml.evaluate.model_card
.venv/Scripts/python -m pytest -q
```
On Linux or macOS use `.venv/bin/python`. Live checks: start `uvicorn api.main:app --port 8010` with NETWATCH_DB pointing at a new file, then `replay/replayer.py --scenario <name> --url http://127.0.0.1:8010/score --limit 3000`.
