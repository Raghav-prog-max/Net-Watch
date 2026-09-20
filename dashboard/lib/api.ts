import type { Alert, DriftStatus } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const listAlerts = (params: Record<string, string> = {}) =>
  get<{ alerts: Alert[] }>(`/alerts?${new URLSearchParams(params)}`).then((r) => r.alerts);

export const getAlert = (id: string) => get<Alert>(`/alerts/${id}`);

export const getDrift = () => get<DriftStatus>("/metrics/drift");

export const getModelMetrics = () => get<Record<string, unknown>>("/metrics/model");

export async function triage(
  id: string,
  status: Alert["status"],
  analyst_label?: string,
  analyst_note?: string,
): Promise<Alert> {
  const res = await fetch(`${BASE}/alerts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, analyst_label, analyst_note }),
  });
  if (!res.ok) throw new Error(`triage failed: ${res.status}`);
  return res.json();
}
