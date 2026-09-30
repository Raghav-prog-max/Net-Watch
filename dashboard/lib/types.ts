// Mirrors api/schemas.py. If one changes, change both in the same PR.

export type Level = "Low" | "Medium" | "High" | "Critical";

export interface Explanation {
  feature: string;
  value: number;
  impact: number;
}

export interface Alert {
  id: string;
  timestamp: string;
  flow: Record<string, string>;
  prediction: {
    family: string;
    confidence: number;
    // set when the flow is shown as Unknown because it looks nothing like the
    // family the classifier named: what the classifier wanted to call it
    rejected_label?: { family: string; confidence: number } | null;
    also_abnormal?: boolean | null;
  };
  anomaly_score: number;
  is_novel: boolean;
  // the API sends this inside `prediction`; lib/api.ts copies it up here
  also_abnormal: boolean;
  severity: { score: number; level: Level };
  explanation: Explanation[];
  mitre: { tactic: string; technique: string };
  recommended_action: string;
  status: "open" | "acknowledged" | "escalated" | "false_positive" | "resolved";
  analyst_label: string | null;
  analyst_note: string | null;
  model_version: string;
}

export interface DriftStatus {
  status: "stable" | "warning" | "drift" | "warming_up";
  top_features?: { feature: string; psi: number }[];
  recommendation?: string;
  alert_rate?: number;
  flows_seen: number;
  bands?: { warning: number; drift: number };
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  "f1-score": number;
  support: number;
}

export interface SummaryMetrics {
  per_class: Record<string, ClassMetrics>;
  macro_f1: number;
  false_positive_rate: number;
  false_alerts_per_10k_benign_flows: number;
  auc: Record<string, { pr_auc: number; roc_auc: number }>;
  confusion_matrix: { labels: string[]; rows: number[][] };
  accuracy_for_reference_only: number;
  // one-vs-rest, thinned: pr = [recall, precision], roc = [fpr, tpr]
  curves?: Record<string, { pr: number[][]; roc: number[][] }>;
}

// Mirrors reports/metrics.json as written by `make train` and served by GET /metrics/model.
export interface EvaluationReport {
  generated?: string;
  classifier: string;
  rows?: { train: number; val: number; test: number };
  threshold: {
    threshold: number;
    fpr_at_threshold: number;
    recall_at_threshold: number;
    fpr_budget: number;
  };
  main: SummaryMetrics;
  // What analysts see: an alert from the classifier OR the anomaly detector.
  // `main` above is the classifier alone. Absent in reports from before 30 Sep 2026.
  system?: {
    benign_flows: number;
    false_positive_rate: number;
    false_alerts_per_10k_benign_flows: number;
    from_classifier_per_10k: number;
    from_detector_only_per_10k: number;
    attack_flows_alerted: number | null;
    budget_per_10k: number;
    within_budget: boolean;
  };
  random_forest_baseline?: SummaryMetrics;
  naive_comparison?: {
    split?: string;
    classifier?: string;
    rows?: { train: number; val: number; test: number };
    threshold?: number;
    per_class_f1?: Record<string, number>;
    honest_false_alerts_per_10k?: number;
    macro_f1: number;
    false_alerts_per_10k: number;
    macro_f1_over_seeds?: { seeds: number; min: number; max: number; mean: number };
    test_flows_from_blocks_seen_in_training?: number | null;
    honest_macro_f1?: number;
    macro_f1_gap?: number;
    inflated?: boolean;
  };
  lofo: {
    family: string;
    test_flows: number;
    attack_threshold?: number;
    caught_by_classifier_alone: number;
    caught_by_anomaly_detector_alone?: number;
    caught_by_full_system: number;
    benign_fpr: number;
  }[];
  novel_families: {
    families: string[];
    flows: number;
    alerted?: number;
    caught_by_anomaly_detector: number;
    label_rejected_as_out_of_family?: number;
    shown_as_unknown?: number;
  };
  synthetic_data?: boolean;
  imbalance_study?: {
    evaluated_on: string;
    chosen: string;
    results: { strategy: string; macro_f1: number; recall?: Record<string, number> }[];
  };
}

export interface ChangelogItem {
  type: "added" | "fixed" | "changed" | "verified" | "tradeoff";
  module: string;
  text: string;
}

export interface ModelVersionEntry {
  version: string;
  title: string;
  date: string;
  status: "active" | "superseded" | "baseline" | "planned";
  commit?: string;
  summary: string;
  // `source` is set when the figure is read from reports/metrics.json
  highlights: { label: string; before?: string; after: string; source?: string }[];
  changelog: ChangelogItem[];
}

export interface ModelRegistryInfo {
  active: string;
  versions?: string[];
  classifier: string;
  thresholds: Record<string, number>;
  feedback: Record<string, number>;
  model_card?: string | null;
  version_history?: ModelVersionEntry[];
  version_history_note?: string;
}

