"use client";

import { useEffect, useState } from "react";

import { getDrift } from "@/lib/api";
import type { DriftStatus } from "@/lib/types";

const COLOR: Record<string, string> = {
  stable: "Low", warning: "High", drift: "Critical", warming_up: "Medium",
};

export default function Drift() {
  const [drift, setDrift] = useState<DriftStatus | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const poll = () =>
      getDrift()
        .then((d) => {
          setDrift(d);
          const top = d.top_features?.[0]?.psi ?? 0;
          setHistory((h) => [...h, top].slice(-40));
        })
        .catch(() => setError("Cannot reach the API."));
    poll();
    const timer = setInterval(poll, 4000);
    return () => clearInterval(timer);
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!drift) return <p className="empty">Loading…</p>;

  const max = Math.max(...history, 0.3);

  return (
    <>
      <h1>Drift monitor</h1>
      <p className="lede">
        Measured on traffic the system considers benign, so a busy attack hour does not read as drift.
      </p>

      <div className="row" style={{ marginBottom: 18 }}>
        <div className="panel stat">
          <b><span className={`badge ${COLOR[drift.status] ?? "Medium"}`}>{drift.status}</span></b>
          <span>current status</span>
        </div>
        <div className="panel stat"><b>{drift.flows_seen.toLocaleString()}</b><span>flows in window</span></div>
        <div className="panel stat">
          <b>{drift.alert_rate !== undefined ? `${(drift.alert_rate * 100).toFixed(1)}%` : "—"}</b>
          <span>alert rate</span>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Highest PSI over time</h2>
        <svg viewBox={`0 0 ${Math.max(history.length * 12, 120)} 80`} style={{ width: "100%", height: 90 }}>
          <line x1="0" y1={80 - (0.25 / max) * 70} x2="100%" y2={80 - (0.25 / max) * 70}
                stroke="var(--red)" strokeDasharray="4 4" strokeWidth="1" />
          {history.map((v, i) => (
            <rect key={i} x={i * 12} y={80 - (v / max) * 70} width="8" height={(v / max) * 70}
                  fill={v > 0.25 ? "var(--red)" : v > 0.1 ? "var(--amber)" : "var(--steel)"} />
          ))}
        </svg>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Dashed line marks PSI 0.25. Above it on three or more features means drift.
        </p>
      </div>

      <div className="panel">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Features moving most</h2>
        {drift.top_features?.length ? (
          <table>
            <thead><tr><th>Feature</th><th>PSI</th></tr></thead>
            <tbody>
              {drift.top_features.map((f) => (
                <tr key={f.feature}><td>{f.feature}</td><td>{f.psi}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">Not enough benign traffic yet. Replay some flows.</p>
        )}
        <p style={{ marginBottom: 0 }}>{drift.recommendation}</p>
      </div>
    </>
  );
}
