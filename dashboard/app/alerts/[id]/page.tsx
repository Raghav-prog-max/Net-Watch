"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import SeverityBadge from "@/components/SeverityBadge";
import ShapBar from "@/components/ShapBar";
import { getAlert, triage } from "@/lib/api";
import type { Alert } from "@/lib/types";

const ACTIONS: { label: string; status: Alert["status"] }[] = [
  { label: "Acknowledge", status: "acknowledged" },
  { label: "Escalate", status: "escalated" },
  { label: "Mark false positive", status: "false_positive" },
  { label: "Resolve", status: "resolved" },
];

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAlert(id).then(setAlert).catch(() => setError("Alert not found."));
  }, [id]);

  async function apply(status: Alert["status"]) {
    setSaving(true);
    try {
      setAlert(await triage(id, status));
    } catch {
      setError("Could not save that. The API may be down.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!alert) return <p className="empty">Loading…</p>;

  return (
    <>
      <button className="action" onClick={() => router.push("/")} style={{ marginBottom: 16 }}>
        Back to alerts
      </button>

      <h1>
        {alert.prediction.family}{" "}
        <SeverityBadge level={alert.severity.level} score={alert.severity.score} />
      </h1>
      <p className="lede">
        {alert.is_novel
          ? "No known attack matches this traffic, and it does not look like normal traffic either."
          : `Classifier confidence ${(alert.prediction.confidence * 100).toFixed(1)}%.`}
        {alert.also_abnormal && !alert.is_novel &&
          " The anomaly detector also flagged it, so this may be a variant rather than the named family."}
      </p>

      <div className="row">
        <div className="panel" style={{ flex: "1 1 380px" }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Why it fired</h2>
          <ShapBar items={alert.explanation} />
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Anomaly score {alert.anomaly_score} · model {alert.model_version}
          </p>
        </div>

        <div className="panel" style={{ flex: "1 1 320px" }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Context</h2>
          <table>
            <tbody>
              <tr>
                <th>ATT&amp;CK</th>
                <td>{alert.mitre.tactic} — {alert.mitre.technique}</td>
              </tr>
              <tr>
                <th>Suggested</th>
                <td>{alert.recommended_action}</td>
              </tr>
              {Object.entries(alert.flow).map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
              <tr>
                <th>Status</th>
                <td>{alert.status}</td>
              </tr>
            </tbody>
          </table>

          <div className="filters" style={{ marginTop: 16 }}>
            {ACTIONS.map((a) => (
              <button
                key={a.status}
                className="action"
                disabled={saving || alert.status === a.status}
                onClick={() => apply(a.status)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            Marking a false positive adds a training label. It does not change any network device.
          </p>
        </div>
      </div>
    </>
  );
}
