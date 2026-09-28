"use client";

import { useEffect, useState } from "react";
import { getModelRegistryInfo, type ModelRegistryInfo } from "@/lib/api";

// where each threshold comes from (api/routes/metrics.py, models/v1/thresholds.json)
const ORIGIN: Record<string, string> = {
  attack_threshold: "False-positive budget",
  anomaly_threshold: "1% of benign validation flows",
  fpr_budget: "ml/config.yaml",
  drift_psi_warning: "Standard PSI band",
  drift_psi_drift: "Standard PSI band",
};

export default function ModelsPage() {
  const [info, setInfo] = useState<ModelRegistryInfo | null>(null);

  useEffect(() => {
    getModelRegistryInfo().then(setInfo);
  }, []);

  if (!info) {
    return (
      <div style={{ padding: "40px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
        Loading model registry telemetry...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "26px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: "var(--nw-text-primary)" }}>
          Model Registry &amp; Training Governance
        </h1>
        <p style={{ margin: 0, color: "var(--nw-text-muted)", fontSize: "13px", maxWidth: "860px" }}>
          Production model versioning and analyst supervision loop. A candidate model is promoted
          only after beating the incumbent on the identical 5-minute time-block test split.
        </p>
        <span className="nw-pill nw-pill-purple" style={{ fontSize: "10px", display: "inline-block", marginTop: "10px" }}>
          {info.source === "live" ? "LIVE · GET /models" : "API OFFLINE · LAST TRAINING RUN"}
        </span>
      </div>


      {/* ── STATS HIGHLIGHTS ─────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginBottom: "26px",
        }}
      >
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-2)", textTransform: "uppercase" }}>
            Active Version
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {info.active}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>Deployed in scoring pipeline</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Classifier Engine
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--nw-text-primary)", margin: "10px 0 4px" }}>
            {info.classifier}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-card-3)" }}>TreeSHAP explainer attached</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-1)", textTransform: "uppercase" }}>
            Analyst False Positives
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-card-1)", margin: "4px 0" }}>
            {info.feedback?.false_positive ?? 0}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>Kept as labels for the next training run</div>
        </div>
      </div>

      {/* ── THRESHOLDS & FEEDBACK GRID ────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "22px",
          marginBottom: "26px",
        }}
      >
        {/* Thresholds Panel */}
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "24px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "16px" }}>
            Active Operating Thresholds
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                <th style={{ padding: "8px 0" }}>Parameter</th>
                <th style={{ padding: "8px 0" }}>Value</th>
                <th style={{ padding: "8px 0", textAlign: "right" }}>Origin</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(info.thresholds).map(([param, val]) => (
                <tr key={param} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <td style={{ padding: "10px 0", textTransform: "capitalize" }}>{param.replace(/_/g, " ")}</td>
                  <td className="mono" style={{ padding: "10px 0", color: "var(--nw-card-2)", fontWeight: 700 }}>
                    {val}
                  </td>
                  <td style={{ padding: "10px 0", textAlign: "right", color: "var(--nw-text-muted)" }}>
                    {ORIGIN[param] ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Feedback Queue */}
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "24px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "16px" }}>
            Analyst Triage Supervision Queue
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                <th style={{ padding: "8px 0" }}>Disposition</th>
                <th style={{ padding: "8px 0" }}>Count</th>
                <th style={{ padding: "8px 0", textAlign: "right" }}>Role in Retraining</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(info.feedback ?? {}).map(([statusKey, count]) => {
                const isFp = statusKey === "false_positive";
                return (
                  <tr key={statusKey} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "10px 0", textTransform: "capitalize" }}>{statusKey.replace(/_/g, " ")}</td>
                    <td className="mono" style={{ padding: "10px 0", fontWeight: 700, color: isFp ? "var(--nw-card-1)" : "#FFFFFF" }}>
                      {count}
                    </td>
                    <td style={{ padding: "10px 0", textAlign: "right", color: "var(--nw-text-muted)" }}>
                      {isFp ? "Relabel as Benign" : "Confirmation Signal"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── GOVERNANCE PROMOTION CALLOUT ──────────────────────── */}
      <div
        style={{
          backgroundColor: "rgba(167, 139, 250, 0.08)",
          borderRadius: "24px",
          padding: "26px",
          border: "1px solid rgba(167, 139, 250, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "18px",
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-card-2)", marginBottom: "4px" }}>
            Governance Protocol // Model Candidate v2 Promotion (planned)
          </div>
          <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", maxWidth: "800px" }}>
            Analyst dispositions are stored with each alert in SQLite. The plan: train a candidate v2 on
            that feedback and promote it ONLY if it achieves a higher macro-F1 than v1 on the identical
            5-minute time-block test split without exceeding the FPR budget. Not built yet: today
            retraining is <code>make train</code>, run by hand.
          </div>
        </div>
      </div>
    </div>
  );
}
