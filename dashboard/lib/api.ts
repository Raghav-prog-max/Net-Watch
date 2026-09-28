import type { Alert, DriftStatus } from "./types";
import {
  INITIAL_MOCK_ALERTS,
  MOCK_EVALUATION_REPORT,
  MOCK_DRIFT_STATUS,
  type EvaluationReport,
} from "./mockData";

// 127.0.0.1, not localhost: on Windows "localhost" can stall ~2 s on IPv6 first,
// which is past the 2 s timeout below and reads as "API offline"
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
// GET /alerts pages at most 100 alerts (api/routes/alerts.py)
const MAX_PAGE_SIZE = 100;

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

/** The API keeps `also_abnormal` inside `prediction`; the UI reads it at the top level. */
export function normalizeAlert(raw: Alert): Alert {
  return {
    ...raw,
    also_abnormal: Boolean(raw.also_abnormal ?? raw.prediction?.also_abnormal ?? false),
  };
}

class ApiUnreachable extends Error {}

/** GET with a 2 s timeout. Throws ApiUnreachable when nothing answers; otherwise
 *  returns the response, so a 503 ("run make train") is not mistaken for offline. */
async function get(path: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: controller.signal });
    isLiveApiConnected = true;
    return res;
  } catch {
    isLiveApiConnected = false;
    throw new ApiUnreachable(path);
  } finally {
    clearTimeout(timeout);
  }
}

function filterLocal(params: Record<string, string>): Alert[] {
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

export async function listAlerts(params: Record<string, string> = {}): Promise<Alert[]> {
  // callers pass `limit`; the API pages with `page` and `size`
  const { limit, ...rest } = params;
  const query = new URLSearchParams(rest);
  query.set("size", String(Math.min(Number(limit) || 50, MAX_PAGE_SIZE)));
  try {
    const res = await get(`/alerts?${query}`);
    if (!res.ok) throw new Error(`GET /alerts ${res.status}`);
    const data: { items: Alert[] } = await res.json();
    return data.items.map(normalizeAlert);
  } catch (e) {
    if (e instanceof ApiUnreachable) return filterLocal(params);
    throw e;
  }
}

export async function getAlert(id: string): Promise<Alert> {
  try {
    const res = await get(`/alerts/${id}`);
    if (!res.ok) throw new Error(`GET /alerts/${id} ${res.status}`);
    return normalizeAlert(await res.json());
  } catch (e) {
    if (!(e instanceof ApiUnreachable)) throw e;
    const found = localAlerts.find((a) => a.id === id);
    if (!found) throw new Error("Alert not found");
    return found;
  }
}

export async function getDrift(): Promise<DriftStatus> {
  try {
    const res = await get("/metrics/drift");
    if (res.status === 503) {
      // the API is up but has no trained models: nothing is being monitored
      return { status: "warming_up", flows_seen: 0, source: "live",
               recommendation: "No trained models loaded. Run `make train`, then restart the API." };
    }
    if (!res.ok) throw new Error(`GET /metrics/drift ${res.status}`);
    return { ...(await res.json()), source: "live" };
  } catch (e) {
    if (e instanceof ApiUnreachable) return { ...MOCK_DRIFT_STATUS, source: "sample" };
    throw e;
  }
}

/** The live evaluation report, or our last training run when the API is offline.
 *  Never a mix of the two. */
export async function getModelMetrics(): Promise<EvaluationReport> {
  try {
    const res = await get("/metrics/model");
    if (!res.ok) throw new Error(`GET /metrics/model ${res.status}`);
    return { ...(await res.json()), source: "live" };
  } catch (e) {
    if (e instanceof ApiUnreachable) return { ...MOCK_EVALUATION_REPORT, source: "snapshot" };
    throw e;
  }
}

export interface ModelRegistryInfo {
  active: string;
  classifier: string;
  thresholds: Record<string, number>;
  feedback: Record<string, number>;
  source?: "live" | "snapshot";
}

export async function getModelRegistryInfo(): Promise<ModelRegistryInfo> {
  try {
    const res = await get("/models");
    if (!res.ok) throw new Error(`GET /models ${res.status}`);
    return { ...(await res.json()), source: "live" };
  } catch (e) {
    if (!(e instanceof ApiUnreachable)) throw e;
    const feedbackCounts: Record<string, number> = {
      false_positive: localAlerts.filter((a) => a.status === "false_positive").length,
      acknowledged: localAlerts.filter((a) => a.status === "acknowledged").length,
      escalated: localAlerts.filter((a) => a.status === "escalated").length,
      resolved: localAlerts.filter((a) => a.status === "resolved").length,
      open: localAlerts.filter((a) => a.status === "open").length,
    };
    const t = MOCK_EVALUATION_REPORT.threshold;
    return {
      active: "v1",
      classifier: `${MOCK_EVALUATION_REPORT.classifier} + Isolation Forest + family novelty check`,
      thresholds: {
        attack_threshold: Number(t.threshold.toFixed(4)),
        fpr_budget: t.fpr_budget,
        drift_psi_warning: 0.1,
        drift_psi_drift: 0.25,
      },
      feedback: feedbackCounts,
      source: "snapshot",
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

  let res: Response;
  try {
    res = await fetch(`${BASE}/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, analyst_label, analyst_note }),
    });
  } catch {
    // offline demo mode: the local copy is the only copy
    if (updatedAlert) return updatedAlert;
    throw new Error("Alert not found");
  }
  // The API answered but refused: say so. Pretending it saved would lose the
  // analyst's label, which is the training data for the next model.
  if (!res.ok) throw new Error(`triage failed: ${res.status}`);
  return normalizeAlert(await res.json());
}
