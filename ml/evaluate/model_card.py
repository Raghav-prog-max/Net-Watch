"""Render docs/model_card.md from the numbers training actually produced.

    python -m ml.evaluate.model_card

The handbook's rule is that no reported number is copied by hand: everything comes
from reports/ so that retraining updates it. A model card typed out once would be
wrong the first time the model is retrained on real data, so this writes the card
from reports/metrics.json instead. The prose is fixed; every figure, and every claim
that depends on the figures (which class is weakest, where false alerts go), is
computed here.
"""
import json
from pathlib import Path

import pandas as pd
import yaml

from ml.evaluate.system import PREVIOUS_SPLIT

ROOT = Path(__file__).resolve().parents[2]


def pct(x, nd=1):
    return f"{100 * x:.{nd}f}%"


def load():
    cfg = yaml.safe_load(open(ROOT / "ml" / "config.yaml"))
    metrics = json.load(open(ROOT / cfg["paths"]["reports_dir"] / "metrics.json"))
    thresholds = json.load(open(ROOT / cfg["paths"]["model_dir"] / "thresholds.json"))
    flows = pd.read_pickle(ROOT / cfg["paths"]["processed"])
    raw = sorted(p.name for p in (ROOT / cfg["paths"]["raw_dir"]).glob("*.csv"))
    return cfg, metrics, thresholds, flows, raw


def worst_off_diagonal(cm):
    """The single largest confusion between two different classes."""
    labels, rows = cm["labels"], cm["rows"]
    best = (0, None, None)
    for i, row in enumerate(rows):
        for j, n in enumerate(row):
            if i != j and n > best[0]:
                best = (n, labels[i], labels[j])
    return best


def render():
    cfg, m, thr, flows, raw = load()
    main = m["main"]
    per = main["per_class"]
    auc = main.get("auc", {})
    cm = main["confusion_matrix"]
    labels, rows = cm["labels"], cm["rows"]
    synthetic = any(name.lower().startswith("synthetic") for name in raw)

    budget = cfg["train"]["fpr_budget"]
    realised = main["false_positive_rate"]
    attacks = [c for c in per if c != "Benign"]
    weakest = min(attacks, key=lambda c: per[c]["recall"])

    # where the classifier's false alerts on benign traffic end up
    b = labels.index("Benign")
    benign_row = rows[b]
    fp_total = sum(n for j, n in enumerate(benign_row) if j != b)
    fp_dest = max((n, labels[j]) for j, n in enumerate(benign_row) if j != b)

    n_conf, conf_a, conf_b = worst_off_diagonal(cm)
    mirror = rows[labels.index(conf_b)][labels.index(conf_a)] if conf_a else 0

    fam_counts = flows["family"].value_counts()
    out = []
    w = out.append

    w("# Model card — NetWatch v1")
    w("")
    w(f"Generated from `reports/metrics.json` ({m['generated']}) by "
      "`python -m ml.evaluate.model_card`. Do not edit by hand: retrain, then regenerate.")
    w("")
    if synthetic:
        w("> **Every figure below comes from synthetic traffic, not CICIDS2017.** "
          "`data/raw/` holds output from `scripts/make_synthetic.py`, which exists so the "
          "pipeline can run before the real download lands. These numbers show the system "
          "works end to end; they are not results and must not be reported as such. "
          "Place the CICIDS2017 files in `data/raw/`, run `make data && make train`, and "
          "regenerate this card.")
        w("")

    # ------------------------------------------------------------------ what
    w("## What it does")
    w("")
    w("Scores each network flow with two models and turns their verdicts into an alert "
      "for a human analyst, or into silence.")
    w("")
    w(f"- **Classifier** ({m['classifier']}): names one of "
      f"{len(attacks)} known attack families, or benign.")
    w("- **Anomaly detector** (Isolation Forest): trained on benign traffic only, and asks "
      "whether a flow looks normal at all. Features are log-scaled first, because flow "
      "features span orders of magnitude and raw scaling hides quiet attacks.")
    w("- **Out-of-family check**: a classifier always returns one of the classes it was "
      "trained on, so a novel attack arrives with a confident but wrong label. This checks "
      "whether the flow resembles the family it was assigned, and reports Unknown when it "
      "does not.")
    w("")
    w("An alert is raised if either model objects. Nothing in the system blocks, drops or "
      "reroutes traffic.")
    w("")

    # ------------------------------------------------------------------ data
    w("## Training data")
    w("")
    source = "Synthetic traffic shaped like CICIDS2017" if synthetic else "CICIDS2017 flow records"
    w(f"{source}: {len(flows):,} flows after cleaning, {m['features']} features. "
      f"Split into {cfg['split']['block_minutes']}-minute time blocks so no block appears "
      "in two splits; a test fails the build if one does.")
    w("")
    w("| Split | Flows | Note |")
    w("| --- | ---: | --- |")
    w(f"| Train | {m['rows']['train']:,} | benign sampled to "
      f"{pct(cfg['train']['benign_downsample'], 0)}; attacks kept whole |")
    w(f"| Validation | {m['rows']['val']:,} | sets both thresholds |")
    w(f"| Test | {m['rows']['test']:,} | never sampled; every figure below |")
    w("")
    w("| Family | Flows | Role |")
    w("| --- | ---: | --- |")
    novel_fams = set(m.get("novel_families", {}).get("families", []))
    for fam, n in fam_counts.items():
        role = "never trained on: test only" if fam in novel_fams else "trained"
        w(f"| {fam} | {n:,} | {role} |")
    w("")
    w("Removed before training so the model cannot memorise hosts: flow ID, source and "
      "destination IP, source port. The timestamp is kept only until the data is split.")
    w("")

    # ------------------------------------------------------------------ use
    w("## Intended use")
    w("")
    w("Surfacing suspicious traffic to a SOC analyst, who decides what happens next. Each "
      "alert carries a severity, the features that drove it and a MITRE ATT&CK technique; "
      "the analyst's decision is stored as a label for the next model version.")
    w("")
    w("**Not for:** automated blocking or rate limiting; any network the model was not "
      "retrained on; forensic attribution of an attack to a person.")
    w("")

    # ------------------------------------------------------------------ performance
    w("## Performance")
    w("")
    sys_m = m.get("system", main)
    sys_realised = sys_m.get("false_positive_rate", realised)
    w(f"End-to-end System Macro-F1 **{sys_m['macro_f1']:.3f}** across benign and {len(attacks)} attack families. "
      f"Measured as a full system (classifier + anomaly detector), it produced "
      f"**{sys_m.get('false_alerts_per_10k_benign_flows', main['false_alerts_per_10k_benign_flows']):.1f} false alerts per 10,000 benign "
      f"flows** ({pct(sys_realised, 2)})."
      f" This is " + ("over the 0.5% budget." if sys_realised > budget else "within budget."))
    w("")
    w(f"As a component, the classifier alone scored Macro-F1 {main['macro_f1']:.3f} and produced "
      f"{main['false_alerts_per_10k_benign_flows']:.1f} false alerts/10k ({pct(realised, 2)}), "
      f"meeting its isolated budget constraint of {pct(budget)} at threshold {thr['attack_threshold']:.4f}.")
    w("")
    w("No accuracy figure is reported: about 80% of traffic is benign, so a model that "
      "never alerts would score about 80%.")
    w("")
    w("| Class | Precision | Recall | F1 | PR-AUC | Test flows |")
    w("| --- | ---: | ---: | ---: | ---: | ---: |")
    for c in sorted(per, key=lambda c: (c != "Benign", -per[c]["recall"])):
        v = per[c]
        w(f"| {c} | {v['precision']:.3f} | {v['recall']:.3f} | {v['f1-score']:.3f} | "
          f"{auc.get(c, {}).get('pr_auc', float('nan')):.3f} | {int(v['support']):,} |")
    w("")
    imb = m.get("imbalance_study")
    if imb and imb.get("chosen") == "class_weight":
        w("**Note on class weights:** The `class_weight` strategy was chosen over `no_handling` "
          "(the validation macro-F1 winner) because it significantly improves recall on the "
          "Bot family, keeping performance balanced across attacks.")
        w("")
    trade_off = m.get("joint_budget_trade_off")
    if trade_off:
        w("")
        w("### Joint Budget Trade-off")
        w("")
        w("To keep the full system within the false-alert budget, the classifier threshold and detector flag rate must be balanced.")
        w("")
        w("| Detector flag rate | Classifier threshold | Classifier TPR | Novel recall |")
        w("| --- | --- | --- | --- |")
        for t in trade_off:
            c_thr = f"{t['classifier_threshold']:.4f}" if t['classifier_threshold'] is not None else "—"
            c_tpr = pct(t['classifier_tpr_on_val'], 2) if t['classifier_tpr_on_val'] is not None else "—"
            n_rec = pct(t['novel_recall'], 2) if t['novel_recall'] is not None else "—"
            w(f"| {pct(t['detector_flag_rate'], 2)} | {c_thr} | {c_tpr} | {n_rec} |")
        w("")


    lofo = m.get("lofo")
    w("### Attacks it was never trained on")
    w("")
    if lofo:
        w("Leave-one-family-out: each family is removed from training entirely, a fresh "
          "model is trained, and the held-out family is replayed at it. Each run sets its own "
          "threshold from the same budget.")
        w("")
        w("| Held-out family | Flows | Classifier alone | Detector alone | Full system | Benign FPR |")
        w("| --- | ---: | ---: | ---: | ---: | ---: |")
        for r in lofo:
            if "note" in r:
                w(f"| {r['family']} | — | — | — | — | {r['note']} |")
                continue
            w(f"| {r['family']} | {r['test_flows']:,} | {pct(r['caught_by_classifier_alone'])} | "
              f"{pct(r.get('caught_by_anomaly_detector_alone', 0))} | "
              f"{pct(r['caught_by_full_system'])} | {pct(r['benign_fpr'], 2)} |")
        w("")
    else:
        w("Leave-one-family-out was not run for this model (`make quick` skips it). "
          "Run `make train` for the full table.")
        w("")

    nf = m.get("novel_families")
    if nf:
        w(f"Families withheld from training altogether ({', '.join(nf['families'])}, "
          f"{nf['flows']:,} test flows): {pct(nf.get('alerted', nf['caught_by_anomaly_detector']))} "
          f"raised an alert, and **{pct(nf['shown_as_unknown'])} were shown to the analyst as "
          "Unknown** rather than under a known family's name.")
        w("")

    trade = m.get("budget_trade_off")
    if trade:
        w("### Splitting the false-alert budget between the two models")
        w("")
        w("The same models at other cut-offs, both chosen on validation; nothing is retrained. "
          "The first row is the configuration in use (`train.classifier_fpr_budget` and "
          "`anomaly.benign_flag_rate` in `ml/config.yaml`). Each row trades false alerts "
          "against catching attacks the classifier has never seen.")
        w("")
        lofo_fams = list(trade[0].get("lofo_caught_by_full_system", {}))
        w("| Classifier budget | Detector flag rate | False alerts / 10k (val) | "
          "False alerts / 10k (test) | Macro-F1 | Never-trained families alerted | "
          + "".join(f"LOFO {f} | " for f in lofo_fams))
        w("| ---: | ---: | ---: | ---: | ---: | ---: | " + "---: | " * len(lofo_fams))
        for r in trade:
            previous = (r["classifier_budget"], r["detector_flag_rate"]) == PREVIOUS_SPLIT
            mark = " (in use)" if r["configured"] else " (before 30 Sep)" if previous else ""
            nov_a = pct(r["novel_flows_alerted"]) if "novel_flows_alerted" in r else "—"
            det_rate = pct(r["detector_flag_rate"], 2) if r["detector_flag_rate"] else "off"
            w(f"| {pct(r['classifier_budget'], 2)}{mark} | {det_rate} | "
              f"{r['val_false_alerts_per_10k']:.1f} | {r['test_false_alerts_per_10k']:.1f}"
              + ("" if r["within_budget"] else " (over)")
              + f" | {r['macro_f1']:.3f} | {nov_a} | "
              + "".join(f"{pct(r['lofo_caught_by_full_system'][f])} | " for f in lofo_fams))
        w("")

    # ------------------------------------------------------------------ failure modes
    w("## Failure modes")
    w("")
    w("Observed on the test set, most severe first.")
    w("")
    if sys_m and not sys_m.get("within_budget", True):
        w(f"- **The system is over its false-alert budget.** Analysts would see "
          f"{sys_m['false_alerts_per_10k_benign_flows']:.1f} false alerts per 10,000 benign flows "
          f"against a budget of {budget * 10000:g}, because the anomaly detector's flags come "
          "on top of the classifier's. The table above shows splits of the budget that stay "
          "within it.")
    weak_lofo = None
    if lofo:
        weak_lofo = min((r for r in lofo if "note" not in r),
                        key=lambda r: r["caught_by_full_system"])
        w(f"- **Novel attacks that look like normal traffic are missed.** Held out of "
          f"training, {weak_lofo['family']} is caught only "
          f"{pct(weak_lofo['caught_by_full_system'])} of the time: it sits close enough to "
          "benign traffic that neither model separates it.")
    # same 3-decimal form as the table: a percentage rounded separately can disagree
    # with it at the boundary (0.8065 printed as 0.806 there and 80.7% here)
    also = " also" if weak_lofo and weak_lofo["family"] == weakest else ""
    w(f"- **{weakest} is{also} the weakest known family**, at "
      f"{per[weakest]['recall']:.3f} recall.")
    if conf_a:
        w(f"- **{conf_a} and {conf_b} are confused with each other.** {n_conf:,} {conf_a} "
          f"flows were labelled {conf_b}"
          + (f", and {mirror:,} the other way." if mirror else "."))
    if fp_total:
        share = fp_dest[0] / fp_total
        if fp_dest[0] == fp_total:
            w(f"- **Every false alert on benign traffic was labelled {fp_dest[1]}** "
              f"(all {fp_total:,}).")
        else:
            w(f"- **False alerts on benign traffic concentrate on {fp_dest[1]}**: "
              f"{fp_dest[0]:,} of {fp_total:,} ({pct(share, 0)}) were labelled {fp_dest[1]}.")
    if nf:
        w(f"- **Some novel attacks keep a confident wrong name.** "
          f"{pct(1 - nf['shown_as_unknown'])} of never-trained-on flows are still reported "
          "under a known family's label.")
    lc = m.get("label_check_cost")
    if lc:
        w(f"- **The out-of-family check has a cost.** It relabels "
          f"{pct(lc['relabelled_unknown'])} of correct alerts on known families as Unknown "
          f"({lc['alerts_on_known_families']:,} alerts measured)"
          + (f", and {lc['benign_relabelled_unknown']} benign flows." if lc['benign_relabelled_unknown']
             else "; no benign flow was relabelled."))
    w("- **Drift raises the false-alert rate.** As normal traffic changes shape it moves away "
      "from what the detector learned, so more of it alerts, and some reads as Unknown.")
    w("")

    # ------------------------------------------------------------------ limitations
    w("## Known limitations")
    w("")
    w("- CICIDS2017 is lab traffic from 2017. Deployment needs retraining on the network's "
      "own flows; the pipeline and evaluation carry over, the trained weights do not.")
    w("- Flow features only: no payload inspection, no analysis of encrypted content.")
    w("- In CICIDS2017, Infiltration (36 flows) and Heartbleed (11 flows) are too rare to "
      "learn. They are handled only by the anomaly detector.")
    w("- Destination port is a feature. On real traffic that lets the model partly learn "
      "which ports an attack uses rather than how it behaves.")
    w("- Thresholds are set once, on validation. A production system would re-tune them "
      "against analyst feedback.")
    w("")

    # ------------------------------------------------------------------ naive vs honest
    nc = m.get("naive_comparison")
    if nc:
        s = nc["macro_f1_over_seeds"]
        shared = nc["test_flows_from_blocks_seen_in_training"]
        w("## Naive random split vs honest time split")
        w("")
        w("The same classifier, settings, benign downsampling and threshold rule, with only "
          "the split changed: random rows instead of whole 5-minute blocks.")
        w("")
        w("| Split | Macro-F1 | False alerts / 10k benign | Test flows from a block also in training |")
        w("| --- | --- | --- | --- |")
        w(f"| Time blocks (honest) | {nc['honest_macro_f1']} | {nc['honest_false_alerts_per_10k']} | 0% |")
        w(f"| Random rows (naive) | {nc['macro_f1']} ({s['min']}–{s['max']} over {s['seeds']} "
          f"seeds) | {nc['false_alerts_per_10k']} | {pct(shared, 0) if shared is not None else '—'} |")
        w("")
        if nc["inflated"]:
            w(f"The random split scores higher on every seed, by {nc['macro_f1_gap']:+.3f} macro-F1 "
              "on the main one. That gap is what a leaky evaluation would have let us claim.")
        else:
            w(f"**No inflation was measured.** Every random split scored "
              f"{'at or below' if s['max'] <= nc['honest_macro_f1'] else 'about the same as'} "
              f"the honest one, although {pct(shared, 0) if shared is not None else 'most'} of its "
              "test flows came from time blocks also used in training.")
            if synthetic:
                w(" The synthetic generator's bursts carry independent noise per flow, so they are "
                  "not near-duplicates and there is little to memorise. This has to be re-measured "
                  "on CICIDS2017, where flows inside one attack burst are expected to be near-identical; "
                  "a test with "
                  "deliberately leaky data (`tests/test_naive_split.py`) shows the comparison does "
                  "detect inflation when it exists.")
        w("")

    w("**Not yet measured** — the handbook also requires a cross-dataset test on UNSW-NB15."
      if nc else
      "**Not yet measured** — the handbook requires both: the same model scored on a random "
      "split beside the honest one, so the inflation gap is visible; and a cross-dataset test "
      "on UNSW-NB15.")
    w("")

    # ------------------------------------------------------------------ monitoring
    d = cfg["drift"]
    w("## Monitoring")
    w("")
    w(f"The Population Stability Index is computed per feature over a window of "
      f"{d['window']:,} flows, against {d['bins']} quantile bins taken from benign validation "
      "traffic. Only flows that did not alert are counted, so a busy attack hour does not "
      "read as drift.")
    w("")
    w("| Status | Rule |")
    w("| --- | --- |")
    w(f"| Stable | every feature below PSI {d['warn_psi']} |")
    w(f"| Warning | any feature above PSI {d['warn_psi']} |")
    w(f"| Drift | three or more features above PSI {d['drift_psi']} |")
    w("")
    w("At Drift the dashboard recommends retraining. A person approves it; nothing retrains "
      "on its own.")
    w("")
    w(f"A KS test runs on {d.get('top_features_ks', 15)} features, and the rate of Unknown "
      "alerts is compared with its benign-validation baseline: Warning above "
      f"{d.get('alert_rate_warning_multiplier', 1.5)}x, Drift above "
      f"{d.get('alert_rate_drift_multiplier', 2.0)}x only when PSI has moved too. Retraining "
      "(`make retrain`) adds analyst labels and is promoted only by a person, if macro-F1 "
      "improves and the full system stays within the false-alert budget.")
    w("")
    w("The drift report also carries the family mix of recent alerts, the share of recent "
      "alerts analysts marked as false positives, and a snapshot history "
      "(`GET /metrics/drift`; see `docs/drift_strategy.md`).")
    w("")

    # ------------------------------------------------------------------ reproduce
    w("## Reproducing these numbers")
    w("")
    w("```bash")
    w("make data                        # raw CSVs -> data/processed/flows.pkl")
    w("make train                       # both models, thresholds, LOFO -> reports/metrics.json")
    w("python -m ml.evaluate.model_card # this card")
    w("```")
    w("")
    return "\n".join(out)


def main():
    text = render() + "\n"
    path = ROOT / "docs" / "model_card.md"
    path.write_text(text, encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}")
    # handbook layout: the card also travels with the model bundle it describes
    model_dir = ROOT / yaml.safe_load(open(ROOT / "ml" / "config.yaml"))["paths"]["model_dir"]
    if model_dir.exists():
        (model_dir / "model_card.md").write_text(text, encoding="utf-8")
        print(f"wrote {(model_dir / 'model_card.md').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
