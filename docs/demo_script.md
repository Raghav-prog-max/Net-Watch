# Demo script (3 minutes)

The handbook's six steps, adapted to alert grouping: a burst of one family is one alert whose
`×count` climbs, not a feed full of rows (rules in [`api/routes/score.py`](../api/routes/score.py)).
Each step is one replayer run, so the demo repeats. The replayer sends only flows the models were
not fitted on: the test split, plus every flow of the never-trained families. Rehearsed end to end
on 2026-10-04 against a fresh API, synthetic data; the counts below are from that run.

## Before you start

1. Start from an empty alert store and a fresh API: the drift window and the grouping state live
   in memory. Stop the API, move `netwatch.db` aside (or set `NETWATCH_DB` to a new file), then
   `make api` (without `make`: the table at the end of [HOW_TO_RUN.md](../HOW_TO_RUN.md)).
2. `make dashboard`, and open three tabs: `/alerts`, `/evaluation`, `/drift`.
3. Run each step from the repository root with the virtual environment's Python
   (`.venv\Scripts\python` on Windows).

## The six steps

| Step | Time | Run | Show and say |
| --- | --- | --- | --- |
| 1. Normal traffic | 20 s | `python replay/replayer.py --scenario normal --rate 60 --limit 1200` | One or two alerts in 1,200 flows (rehearsal: 1 alert from 6 flows, 0.5%). The false-alert rate is the system's, classifier and anomaly detector together: the Evaluation headline, 44.7 per 10k against a budget of 50. Replayed in full, the 5,598 held-out normal flows raise 25 alerts, 44.7 per 10k: the same number, because they are the same flows. |
| 2. Known attack | 40 s | `python replay/replayer.py --scenario known --rate 60 --limit 2400` | DDoS, DoS and PortScan each arrive as one Critical alert whose count climbs live (rehearsal: ×672, ×946, ×760). "2,400 attack flows, a handful of alerts to triage, not 2,400" (rehearsal: six). Open the DDoS alert: confidence, SHAP reasons, MITRE T1498. |
| 3. Novel attack | 40 s | First, on `/alerts`: **Novel Zero-Day Only**, then **Resolve** every open Unknown alert. Then `python replay/replayer.py --scenario novel --rate 60` | A new **Unknown · NOVEL** alert at the top, count climbing (rehearsal: ×544 of 600 flows). The headline moment: a family the model never trained on, flagged instead of mislabelled. |
| 4. Analyst loop | 20 s | none | Mark the DDoS alert **false positive**. It stays dismissed; DDoS flows after this open a new alert instead of hiding inside it. The **Analyst feedback** counter at the top of `/alerts` goes up by one as you click. |
| 5. Honest numbers | 30 s | none | `/evaluation`: per-class recall, PR-AUC, the 44.7/10k headline and its split (classifier 41.1 + detector 3.6), the threshold card, and the naive-split comparison. On synthetic data the naive split shows no inflation; say so. |
| 6. Drift | 30 s | `python replay/replayer.py --scenario drift --rate 60 --limit 1800` | `/drift`: the badge turns red and recommends retraining. At this rate it is the alert-rate rule that turns it red, with feature PSI at Warning; say "the alert rate doubled and the features are moving". |

## Why step 3 starts by resolving

An open alert absorbs every flow of its family for 60 s after its last one. Normal traffic and
the known-attack step both leave an open Unknown alert (rehearsal: ×19), so without the resolve
the novel attack shows as a bigger count on that old row instead of a new one. On stage, say the
analyst has reviewed and cleared the earlier Unknown alert.

## Things that can surprise you

- The drift badge may already show **Warning** after step 2 (it did in the rehearsal): the
  alert-rate rule watches Unknown alerts, and attack traffic raises them.
- PSI itself reaches Drift (above 0.25 on three features) only at the end of a full drift replay:
  all of the test split's benign flows (5,598 on the synthetic data), about 45 s at the API's full
  speed. To show that, start `python replay/replayer.py --scenario drift --rate 400` at the start
  of step 5, so it runs through step 6.
- The drift step raises alerts too: about 7% of the shifted flows look abnormal to the detector,
  since bigger packets over longer flows are unlike anything in training.
- On CICIDS2017, `--scenario day` replays the held-out Monday unchanged: real drift, but nobody
  has checked that it trips the monitor, so the demo uses `drift`.
- Every alert in the rehearsal was Critical, including the one from normal traffic in step 1.
- On CICIDS2017 the never-trained families are tiny (Infiltration and Heartbleed, a few dozen
  flows), so step 3 lasts about a second at `--rate 60`. Lower `--rate` to stretch it.
- The replayer prints the alert rate as flows that raised an alert; the dashboard shows alerts.
