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
  prediction: { family: string; confidence: number };
  anomaly_score: number;
  is_novel: boolean;
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
}
