import type { Alert, DriftStatus, EvaluationReport, ModelRegistryInfo } from "./types";

export type { EvaluationReport, ModelRegistryInfo } from "./types";

// 127.0.0.1, not localhost: on Windows "localhost" can stall ~2 s on IPv6 first,
// which is past the 2 s timeout below and reads as "API offline"
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
// GET /alerts pages at most 100 alerts (api/routes/alerts.py)
const MAX_PAGE_SIZE = 100;

/** The API keeps `also_abnormal` inside `prediction`; the UI reads it at the top level. */
export function normalizeAlert(raw: Alert): Alert {
  return {
    ...raw,
    also_abnormal: Boolean(raw.also_abnormal ?? raw.prediction?.also_abnormal ?? false),
  };
}

export class ApiUnreachable extends Error {
  constructor(path: string) {
    super(`API unreachable (${path})`);
  }
}

/** GET with a 2 s timeout. Throws ApiUnreachable when nothing answers; otherwise
 *  returns the response, so a 503 ("run make train") is not mistaken for offline. */
async function get(path: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    return await fetch(`${BASE}${path}`, { cache: "no-store", signal: controller.signal });
  } catch {
    throw new ApiUnreachable(path);
  } finally {
    clearTimeout(timeout);
  }
}

export async function listAlerts(params: Record<string, string> = {}): Promise<Alert[]> {
  // callers pass `limit`; the API pages with `page` and `size`
  const { limit, ...rest } = params;
  const query = new URLSearchParams(rest);
  query.set("size", String(Math.min(Number(limit) || 50, MAX_PAGE_SIZE)));
  const res = await get(`/alerts?${query}`);
  if (!res.ok) throw new Error(`GET /alerts ${res.status}`);
  const data: { items: Alert[] } = await res.json();
  return data.items.map(normalizeAlert);
}

export async function getAlert(id: string): Promise<Alert> {
  const res = await get(`/alerts/${id}`);
  if (!res.ok) throw new Error(`GET /alerts/${id} ${res.status}`);
  return normalizeAlert(await res.json());
}

export async function getDrift(): Promise<DriftStatus> {
  const res = await get("/metrics/drift");
  if (res.status === 503) {
    // the API is up but has no trained models: nothing is being monitored
    return {
      status: "warming_up",
      flows_seen: 0,
      recommendation: "No trained models loaded. Run `make train`, then restart the API.",
    };
  }
  if (!res.ok) throw new Error(`GET /metrics/drift ${res.status}`);
  return await res.json();
}

export async function getModelMetrics(): Promise<EvaluationReport> {
  const res = await get("/metrics/model");
  if (!res.ok) throw new Error(`GET /metrics/model ${res.status}`);
  return await res.json();
}

export async function getModelRegistryInfo(): Promise<ModelRegistryInfo> {
  const res = await get("/models");
  if (!res.ok) throw new Error(`GET /models ${res.status}`);
  return await res.json();
}

export async function triage(
  id: string,
  status: Alert["status"],
  analyst_label?: string,
  analyst_note?: string,
): Promise<Alert> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, analyst_label, analyst_note }),
    });
  } catch {
    throw new ApiUnreachable(`/alerts/${id}`);
  }
  // The API answered but refused: say so. Pretending it saved would lose the
  // analyst's label, which is the training data for the next model.
  if (!res.ok) throw new Error(`triage failed: ${res.status}`);
  return normalizeAlert(await res.json());
}
