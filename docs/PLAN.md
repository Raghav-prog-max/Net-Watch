# Implementation plan, day by day

Fourteen days, six people. Owners are A (ML lead), B (anomaly and LOFO), C (data and
evaluation), D (backend), R (frontend), F (MLOps and pitch).

Two rules hold all the way through. Nothing merges to `main` unless `make train` and
`make test` still pass. If the day-8 gate is missed, scope gets cut, not the deadline.

---

## Day 1 — everyone runs the same thing

| Owner | Task | Done when |
|---|---|---|
| All | Clone, `pip install -r requirements.txt`, `make synthetic && make data && make quick` | Everyone has their own `reports/metrics.json` |
| C | Start the CICIDS2017 download (`docs/DATA_SETUP.md`), take `GeneratedLabelledFlows.zip` | Download running |
| F | Repo, branch protection, one-PR-one-reviewer rule, shared tracker | Every task below has an owner and a day |
| D, R | Read `api/schemas.py` together, agree the alert shape | Contract frozen; changes now need both of you |

Hazard: the download needs a form and can be slow. Start it before anything else.

## Day 2 — real data in, leakage out

| Owner | Task | Done when |
|---|---|---|
| C | `make data` on the real CSVs; compare counts against the table in `docs/DATA_SETUP.md` | Counts match within a few percent |
| C | Fix any family showing as `Unknown` (label encoding, see the data doc) | All 15 raw labels map |
| C | `make test` on the real data | Leakage test passes |
| A | First real `make quick`; read per-class recall, not accuracy | Baseline numbers written in the tracker |
| D | SQLite store and `/alerts` returning seeded rows | `curl localhost:8000/alerts` works |
| R | Dashboard skeleton against mock JSON matching the schema | Feed renders 20 fake alerts |

## Days 3–4 — models that mean something

| Owner | Task | Done when |
|---|---|---|
| A | LightGBM vs Random Forest on the honest split; tune on validation only | Both sets of numbers in `reports/` |
| A | Threshold from the FPR budget; try 0.001, 0.005, 0.01 | Chosen budget justified in one sentence |
| C | Imbalance study: none, class weights, benign undersampling, SMOTE in folds | Table of macro-F1 per strategy |
| C | Run the same model on a random split, for comparison only | You can state the inflation gap out loud |
| B | Isolation Forest on benign; tune `benign_flag_rate` | Benign false-alert rate you can live with |
| D | `/score` wired to real artefacts; WebSocket broadcast | An alert reaches a browser console |
| R | Alert detail page, triage buttons against mock | Buttons call `PATCH` and update state |

## Day 5 — the proof experiment

| Owner | Task | Done when |
|---|---|---|
| B | Full `make train` including LOFO for all four families | `reports/metrics.json` has real LOFO numbers |
| B | Test the detector on Infiltration and Heartbleed | `novel_families.caught_by_anomaly_detector` recorded |
| B | `--holdout <family>` demo model for the pitch | "Unknown / novel" appears in a live alert |
| A | SHAP explanations on (install `shap`), sanity-check three alerts by hand | Top features make sense to a human |
| R, D | Frontend against the live API | Live feed updates with no page refresh |

If LOFO recall is poor for every family, say so and show the trade-off curve. A weak
honest result beats a strong dishonest one, and judges can tell the difference.

## Days 6–8 — integration, then the gate

| Owner | Task | Done when |
|---|---|---|
| D | Replayer end to end at 40–100 flows/s | Four scenarios run without an error |
| R | Evaluation page reading `/metrics/model` | Numbers on screen match the JSON |
| F | Drift monitor and `/metrics/drift` | `--scenario drift` moves the status |
| A | Severity weights reviewed with the team | Nobody disputes a Critical |
| All | **Day 8 gate: full demo start to finish, one run, no edits** | If it fails, cut the Models page and v2 retraining today |

## Days 9–11 — the enterprise half

| Owner | Task | Done when |
|---|---|---|
| R | Drift page and models page | All five routes usable |
| D | Feedback stored and counted; `/models` exposes it | Marking false positives increments the count |
| C | Naive vs honest comparison written up; limitations drafted | `docs/` has both |
| B | Model card filled from `reports/metrics.json` | No blanks left |
| F | Docker Compose runs api and dashboard together | `docker compose up` gives a working demo |
| A | Retrain v2 with analyst labels; compare against v1 on the same test set | v2 promoted, or rejected with a reason |

## Days 12–13 — freeze

| Owner | Task | Done when |
|---|---|---|
| All | Feature freeze. Bug fixes only | No new endpoints, no new pages |
| C | Re-derive every number in the deck from `reports/` | Deck and JSON agree exactly |
| D | Seed the database so the demo works with no live scoring | Offline fallback tested |
| F | Record the backup demo video | Video covers all five demo beats |
| R | Empty states, error states, laptop-screen check | Nothing breaks when the API is down |

## Day 14 — pitch

Rehearse twice, timed. Prepare the seven judge questions from the handbook. Assign one
person per question so answers do not collide. Have the video and a seeded database
ready in a second window.

---

## Cut list, in order

If you are behind, drop these in this order and say nothing about them in the pitch:

1. Models page (`/models`)
2. v2 retraining with analyst labels
3. SHAP (the z-score fallback already ships)
4. LightGBM (the sklearn fallback already ships)
5. Docker Compose (run the two processes by hand)

Never cut: the leakage-free split, the LOFO experiment, per-class metrics with FPR, or
the fact that nothing auto-blocks. Those four are the assignment.
