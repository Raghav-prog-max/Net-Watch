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
  // added by lib/api.ts: "sample" when the API is unreachable
  source?: "live" | "sample";
}
