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
    w(f"Macro-F1 **{main['macro_f1']:.3f}** across benign and {len(attacks)} attack families. "
      f"The alert threshold ({thr['attack_threshold']:.4f}) was chosen on validation to stay "
      f"within a false-positive budget of {pct(budget)}; on the test set it produced "
      f"**{main['false_alerts_per_10k_benign_flows']:.1f} false alerts per 10,000 benign "
      f"flows** ({pct(realised, 2)})"
      + (", slightly over budget." if realised > budget else ", within budget."))
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

    # ------------------------------------------------------------------ failure modes
    w("## Failure modes")
    w("")
    w("Observed on the test set, most severe first.")
    w("")
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
    w("**Not yet measured** — the handbook requires both: the same model scored on a random "
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
    w("**Not yet built** — the handbook specifies these as well: a KS test on the top 15 "
      "features; alert-rate rules (Warning above 1.5x baseline, Drift above 2x); tracking the "
      "share of alerts analysts mark as false positives; and v2 retraining, promoted only if "
      "macro-F1 improves and the false-positive rate stays within budget.")
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
    path = ROOT / "docs" / "model_card.md"
    path.write_text(render() + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
