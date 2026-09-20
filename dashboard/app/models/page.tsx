"use client";

import { useEffect, useState } from "react";

interface ModelInfo {
  active: string;
  classifier: string;
  thresholds: Record<string, number>;
  feedback: Record<string, number>;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Models() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/models`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError("Cannot reach the API."));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!info) return <p className="empty">Loading…</p>;

  return (
    <>
      <h1>Models</h1>
      <p className="lede">
        A new model is promoted only after it beats the current one on the same test set.
      </p>

      <div className="row">
        <div className="panel stat"><b>{info.active}</b><span>active version</span></div>
        <div className="panel stat"><b>{info.classifier}</b><span>classifier</span></div>
        <div className="panel stat">
          <b>{info.feedback?.false_positive ?? 0}</b><span>false positives marked by analysts</span>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Thresholds in force</h2>
        <table>
          <tbody>
            {Object.entries(info.thresholds).map(([k, v]) => (
              <tr key={k}><th>{k.replace(/_/g, " ")}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Triage so far</h2>
        <table>
          <tbody>
            {Object.entries(info.feedback ?? {}).map(([k, v]) => (
              <tr key={k}><th>{k.replace(/_/g, " ")}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
