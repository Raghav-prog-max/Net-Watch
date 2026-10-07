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
  // flows of this family folded into the alert while it was open (api/routes/score.py)
  flow_count: number;
}

export interface DriftHistoryPoint {
  flows_scored: number;
  timestamp: string;
  status: DriftStatus["status"];
  max_psi: number | null;        // null while the window was still warming up
  top_feature: string | null;
  alert_rate: number | null;
  unexplained_alert_rate: number | null;
}

export interface DriftStatus {
  status: "stable" | "warning" | "drift" | "warming_up";
  top_features?: { feature: string; psi: number }[];
  recommendation?: string;
  alert_rate?: number;
  flows_seen: number;
  flows_scored?: number;
  bands?: { warning: number; drift: number };
  // one snapshot every `history_every` flows scored (ml/config.yaml), oldest first
  history?: DriftHistoryPoint[];
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
/** What a rate on unseen attacks rests on (ml/evaluate/metrics.py support):
 *  `hits` of `of` flows, and the 95% Wilson interval of the rate. */
export interface Support {
  hits: number;
  of: number;
  interval_95: [number, number] | null;
}

export interface EvaluationReport {
  generated?: string;
  classifier: string;
  rows?: { train: number; val: number; test: number };
  threshold: {
    threshold: number;
    fpr_at_threshold: number;
    recall_at_threshold: number;
    // the classifier's share of the budget (train.classifier_fpr_budget); before
    // 30 Sep 2026 the classifier had the whole budget and this was all of it
    fpr_budget: number;
  };
  // the classifier alone; what analysts see is `system`
  main: SummaryMetrics;
  // What analysts see: an alert from the classifier OR the anomaly detector, on
  // the benign test flows, against the whole budget (train.fpr_budget).
  // Absent in reports from before 30 Sep 2026. Read it through lib/falseAlerts.ts.
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
    caught_by_full_system_support?: Support;
    benign_fpr: number;
  }[];
  novel_families: {
    families: string[];
    flows: number;
    alerted?: number;
    alerted_support?: Support;
    caught_by_anomaly_detector: number;
    label_rejected_as_out_of_family?: number;
    shown_as_unknown?: number;
    shown_as_unknown_support?: Support;
    per_family?: {
      family: string;
      flows: number;
      alerted?: number;
      shown_as_unknown?: number;
      alerted_support: Support;
      shown_as_unknown_support: Support;
    }[];
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

/* ── USER MANAGEMENT & RBAC ────────────────────────────────────────── */

export type UserRole = "admin" | "tier_3" | "tier_2" | "tier_1" | "auditor";
export type UserStatus = "active" | "suspended" | "pending";

export interface UserPermission {
  id: string;
  name: string;
  description: string;
  category: "Alert Operations" | "Incident Response" | "Model Governance" | "Administration";
}

export interface RoleDefinition {
  id: UserRole;
  title: string;
  tier: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  permissions: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department: string;
  twoFactorEnabled: boolean;
  avatarColor: string;
  initials: string;
  lastActive: string;
  createdAt: string;
  shift?: string;
  assignedAlertsCount?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  details: string;
  severity: "info" | "warning" | "critical";
}


