import type { Alert, DriftStatus } from "./types";
import {
  INITIAL_MOCK_ALERTS,
  MOCK_EVALUATION_REPORT,
  MOCK_DRIFT_STATUS,
  type EvaluationReport,
} from "./mockData";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// In-memory alert store for offline / demo mode
let localAlerts: Alert[] = [...INITIAL_MOCK_ALERTS];
let isLiveApiConnected = false;

export function isBackendOnline(): boolean {
  return isLiveApiConnected;
}

export function resetLocalAlerts() {
  localAlerts = [...INITIAL_MOCK_ALERTS];
}

export function addLocalAlert(alert: Alert) {
  localAlerts = [alert, ...localAlerts.filter((a) => a.id !== alert.id)].slice(0, 500);
}

export async function listAlerts(params: Record<string, string> = {}): Promise<Alert[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE}/alerts?${new URLSearchParams(params)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    isLiveApiConnected = true;
    return data.alerts;
  } catch {
    isLiveApiConnected = false;
    let list = [...localAlerts];
    if (params.severity && params.severity !== "All") {
      list = list.filter((a) => a.severity.level === params.severity);
    }
    if (params.family) {
      list = list.filter((a) => a.prediction.family === params.family);
    }
    if (params.status) {
      list = list.filter((a) => a.status === params.status);
    }
    return list;
  }
}

export async function getAlert(id: string): Promise<Alert> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE}/alerts/${id}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`${res.status}`);
    isLiveApiConnected = true;
    return res.json();
  } catch {
    const found = localAlerts.find((a) => a.id === id);
    if (!found) throw new Error("Alert not found");
    return found;
  }
}

export async function getDrift(): Promise<DriftStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE}/metrics/drift`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`${res.status}`);
    isLiveApiConnected = true;
    return res.json();
  } catch {
    return MOCK_DRIFT_STATUS;
  }
}

export async function getModelMetrics(): Promise<EvaluationReport> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE}/metrics/model`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`${res.status}`);
    const liveReport = await res.json();
    isLiveApiConnected = true;
    // Enrich with naive comparison if not present in raw backend report
    return {
      ...MOCK_EVALUATION_REPORT,
      ...liveReport,
      naive_comparison: liveReport.naive_comparison ?? MOCK_EVALUATION_REPORT.naive_comparison,
      lofo: liveReport.lofo ?? MOCK_EVALUATION_REPORT.lofo,
    };
  } catch {
    return MOCK_EVALUATION_REPORT;
  }
}

export async function getModelRegistryInfo(): Promise<{
  active: string;
  classifier: string;
  thresholds: Record<string, number>;
  feedback: Record<string, number>;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE}/models`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`${res.status}`);
    isLiveApiConnected = true;
    return res.json();
  } catch {
    const feedbackCounts: Record<string, number> = {
      false_positive: localAlerts.filter((a) => a.status === "false_positive").length,
      acknowledged: localAlerts.filter((a) => a.status === "acknowledged").length,
      escalated: localAlerts.filter((a) => a.status === "escalated").length,
      resolved: localAlerts.filter((a) => a.status === "resolved").length,
      open: localAlerts.filter((a) => a.status === "open").length,
    };
    return {
      active: "v1-production",
      classifier: "LightGBM + IsolationForest",
      thresholds: {
        attack_threshold: 0.812,
        benign_flag_rate: 0.01,
        fpr_budget: 0.005,
        drift_psi_warning: 0.10,
        drift_psi_drift: 0.25,
      },
      feedback: feedbackCounts,
    };
  }
}

export async function triage(
  id: string,
  status: Alert["status"],
  analyst_label?: string,
  analyst_note?: string,
): Promise<Alert> {
  // Always update local memory first so UI responds instantaneously
  let updatedAlert: Alert | null = null;
  localAlerts = localAlerts.map((a) => {
    if (a.id === id) {
      updatedAlert = {
        ...a,
        status,
        analyst_label: analyst_label !== undefined ? analyst_label : a.analyst_label,
        analyst_note: analyst_note !== undefined ? analyst_note : a.analyst_note,
      };
      return updatedAlert;
    }
    return a;
  });

  try {
    const res = await fetch(`${BASE}/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, analyst_label, analyst_note }),
    });
    if (!res.ok) throw new Error(`triage failed: ${res.status}`);
    return res.json();
  } catch {
    if (updatedAlert) return updatedAlert;
    throw new Error("Alert not found");
  }
}
