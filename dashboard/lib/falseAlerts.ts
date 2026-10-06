import type { EvaluationReport } from "./types";

// The false-alert figure every page shows. An analyst gets an alert when the
// classifier passes its threshold OR the anomaly detector flags a flow, so the
// headline is that union (`report.system`) against the whole budget. The
// classifier's own rate (`report.main`) and its share of the budget
// (`threshold.fpr_budget`) are parts of it, never the headline: shown as one,
// they undercounted what analysts face and compared it to the wrong budget.
export interface FalseAlerts {
  per10k: number;
  falsePositiveRate: number;
  budgetPer10k: number;
  // null for a report from before the system figure existed
  withinBudget: boolean | null;
  fromClassifierPer10k: number;
  fromDetectorPer10k: number | null;
  classifierBudgetPer10k: number;
}

export function falseAlerts(report: EvaluationReport): FalseAlerts {
  const sys = report.system;
  const classifierBudgetPer10k = Math.round(report.threshold.fpr_budget * 10000);
  if (!sys) {
    // older report: the classifier was the only alert source counted, and had the whole budget
    const per10k = report.main.false_alerts_per_10k_benign_flows;
    return {
      per10k,
      falsePositiveRate: report.main.false_positive_rate,
      budgetPer10k: classifierBudgetPer10k,
      withinBudget: null,
      fromClassifierPer10k: per10k,
      fromDetectorPer10k: null,
      classifierBudgetPer10k,
    };
  }
  return {
    per10k: sys.false_alerts_per_10k_benign_flows,
    falsePositiveRate: sys.false_positive_rate,
    budgetPer10k: sys.budget_per_10k,
    withinBudget: sys.within_budget,
    fromClassifierPer10k: sys.from_classifier_per_10k,
    fromDetectorPer10k: sys.from_detector_only_per_10k,
    classifierBudgetPer10k,
  };
}

/** "classifier 41.1 + detector 3.6 · budget ≤ 50/10k", or the classifier alone for an old report. */
export function falseAlertsBreakdown(fa: FalseAlerts): string {
  const budget = `budget ≤ ${fa.budgetPer10k}/10k${fa.withinBudget === false ? " (over budget)" : ""}`;
  return fa.fromDetectorPer10k == null
    ? `Classifier only · ${budget}`
    : `Classifier ${fa.fromClassifierPer10k} + anomaly detector ${fa.fromDetectorPer10k} · ${budget}`;
}
