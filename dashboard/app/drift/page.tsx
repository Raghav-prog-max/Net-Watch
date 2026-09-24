"use client";

import { useEffect, useState } from "react";
import { getDrift } from "@/lib/api";
import {
  MOCK_DRIFT_STATUS,
  MOCK_DRIFT_WARNING,
  MOCK_DRIFT_CRITICAL,
} from "@/lib/mockData";
import type { DriftStatus } from "@/lib/types";

export default function DriftMonitorPage() {
  const [drift, setDrift] = useState<DriftStatus>(MOCK_DRIFT_STATUS);
  const [history, setHistory] = useState<number[]>([
    0.04, 0.05, 0.04, 0.06, 0.05, 0.07, 0.05, 0.06, 0.08, 0.09, 0.08, 0.07,
  ]);
  const [activeScenario, setActiveScenario] = useState<"stable" | "warning" | "drift">("stable");
  const [retrainSubmitted, setRetrainSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchDrift = () => {
      getDrift()
        .then((d) => {
          if (!mounted) return;
          if (activeScenario === "stable" && d.status !== "warming_up") {
            setDrift(d);
            const top = d.top_features?.[0]?.psi ?? 0.05;
            setHistory((prev) => [...prev, top].slice(-30));
          }
        })
        .catch(() => {});
    };

    fetchDrift();
    const interval = setInterval(fetchDrift, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeScenario]);

  function handleScenarioSwitch(mode: "stable" | "warning" | "drift") {
    setActiveScenario(mode);
    setRetrainSubmitted(false);
    if (mode === "stable") {
      setDrift(MOCK_DRIFT_STATUS);
      setHistory([0.04, 0.05, 0.04, 0.06, 0.05, 0.07, 0.06, 0.05, 0.04]);
    } else if (mode === "warning") {
      setDrift(MOCK_DRIFT_WARNING);
      setHistory([0.05, 0.08, 0.11, 0.14, 0.16, 0.18, 0.17, 0.18]);
    } else {
      setDrift(MOCK_DRIFT_CRITICAL);
      setHistory([0.05, 0.09, 0.14, 0.19, 0.24, 0.28, 0.34, 0.38]);
    }
  }

  const isDrift = drift.status === "drift" || (drift.top_features?.[0]?.psi ?? 0) >= 0.25;
  const isWarn = drift.status === "warning";
  const maxPsi = Math.max(...history, 0.4);

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "26px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: "var(--nw-text-primary)" }}>
            Distribution Drift Monitor
          </h1>
          <p style={{ margin: 0, color: "var(--nw-text-muted)", fontSize: "13px", maxWidth: "860px" }}>
            Population Stability Index (PSI) computed exclusively over traffic the system considers benign.
            An attack burst does not read as distribution drift.
          </p>
        </div>

        {/* Scenario Switcher */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--nw-text-muted)", fontWeight: 600 }}>DEMO SCENARIOS:</span>
          <button
            onClick={() => handleScenarioSwitch("stable")}
            className={`nw-btn-pill ${activeScenario === "stable" ? "nw-btn-lime" : "nw-btn-dark"}`}
          >
            Stable
          </button>
          <button
            onClick={() => handleScenarioSwitch("warning")}
            className={`nw-btn-pill ${activeScenario === "warning" ? "nw-btn-soft-purple" : "nw-btn-dark"}`}
          >
            Warning
          </button>
          <button
            onClick={() => handleScenarioSwitch("drift")}
            className={`nw-btn-pill ${activeScenario === "drift" ? "nw-btn-amber" : "nw-btn-dark"}`}
          >
            Drift (Retrain)
          </button>
        </div>
      </div>

      {/* ── RETRAIN RECOMMENDED CALLOUT ───────────────────────── */}
      {isDrift && (
        <div
          style={{
            backgroundColor: "rgba(244, 169, 62, 0.1)",
            borderRadius: "20px",
            padding: "20px 24px",
            marginBottom: "24px",
            border: "1px solid rgba(244, 169, 62, 0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-card-1)", marginBottom: "4px" }}>
              ▲ Retrain Recommended // Critical Distribution Shift
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-primary)", maxWidth: "800px" }}>
              Monitored features exceed critical threshold (PSI &ge; 0.25). The underlying network distribution
              has statistically drifted from training baselines. Human analyst approval required to queue candidate v2.
            </div>
          </div>

          <button
            onClick={() => setRetrainSubmitted(true)}
            disabled={retrainSubmitted}
            className="nw-btn-pill nw-btn-amber"
          >
            {retrainSubmitted ? "✓ Retraining Queued" : "Approve Retraining →"}
          </button>
        </div>
      )}

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
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Current Status
          </div>
          <div style={{ margin: "8px 0" }}>
            <span
              className={`nw-pill ${
                isDrift ? "nw-pill-amber" : isWarn ? "nw-pill-purple" : "nw-pill-lime"
              }`}
              style={{ fontSize: "12px", padding: "5px 14px" }}
            >
              {drift.status.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            {isDrift ? "Retrain recommended" : "Operating within limits"}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Benign Window Flows
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {drift.flows_seen.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-card-2)" }}>Unflagged flows evaluated</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Window Alert Rate
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {drift.alert_rate !== undefined ? `${(drift.alert_rate * 100).toFixed(1)}%` : "1.4%"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>Fraction of flows alerted</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            PSI Thresholds
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-text-primary)", margin: "10px 0 4px" }}>
            Warning: <span style={{ color: "var(--nw-card-2)" }}>&ge;0.10</span> · Drift: <span style={{ color: "var(--nw-card-1)" }}>&ge;0.25</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>10-quantile bin boundaries</div>
        </div>
      </div>

      {/* ── HIGHEST PSI OVER TIME TIMELINE ────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "24px",
          padding: "24px",
          marginBottom: "26px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
              Highest Feature PSI Over Time
            </div>
            <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
              Dashed line marks critical threshold PSI 0.25
            </div>
          </div>
        </div>

        {/* Timeline SVG */}
        <div style={{ width: "100%", height: "140px", backgroundColor: "#111114", borderRadius: "16px", padding: "16px" }}>
          <svg viewBox="0 0 600 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            {/* Threshold Line at 0.25 */}
            {(() => {
              const y025 = 100 - (0.25 / maxPsi) * 90;
              return (
                <>
                  <line
                    x1="0"
                    y1={y025}
                    x2="600"
                    y2={y025}
                    stroke="var(--nw-card-1)"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                  />
                  <text
                    x="590"
                    y={y025 - 4}
                    textAnchor="end"
                    fill="var(--nw-card-1)"
                    fontFamily="var(--font-sans)"
                    fontSize="9"
                    fontWeight="700"
                  >
                    PSI 0.25 (RETRAIN THRESHOLD)
                  </text>
                </>
              );
            })()}

            {/* Bars */}
            {history.map((val, idx) => {
              const xStep = 600 / Math.max(history.length, 12);
              const x = idx * xStep + 4;
              const barWidth = Math.max(xStep - 6, 8);
              const height = (val / maxPsi) * 90;
              const y = 100 - height;
              const isOverDrift = val >= 0.25;
              const isOverWarning = val >= 0.10;

              return (
                <rect
                  key={idx}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="4"
                  fill={
                    isOverDrift
                      ? "var(--nw-card-1)"
                      : isOverWarning
                      ? "var(--nw-card-2)"
                      : "var(--nw-card-3)"
                  }
                />
              );
            })}
          </svg>
        </div>

        <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--nw-text-muted)" }}>
          {drift.recommendation}
        </div>
      </div>

      {/* ── TOP MONITORED FEATURES TABLE ──────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "24px",
          padding: "24px",
        }}
      >
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "4px" }}>
          Features Moving Most (PSI Ranking)
        </div>
        <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginBottom: "18px" }}>
          Comparing current 5,000-flow window against training reference quantile bins
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                <th style={{ padding: "10px 14px" }}>Feature Name</th>
                <th style={{ padding: "10px 14px" }}>PSI Score</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px" }}>Shift Assessment</th>
              </tr>
            </thead>
            <tbody>
              {(drift.top_features ?? []).map((f) => {
                const isD = f.psi >= 0.25;
                const isW = f.psi >= 0.10 && f.psi < 0.25;

                return (
                  <tr key={f.feature} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>{f.feature}</td>
                    <td
                      className="mono"
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: isD ? "var(--nw-card-1)" : isW ? "var(--nw-card-2)" : "var(--nw-card-3)",
                      }}
                    >
                      {f.psi.toFixed(3)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span className={`nw-pill ${isD ? "nw-pill-amber" : isW ? "nw-pill-purple" : "nw-pill-lime"}`}>
                        {isD ? "CRITICAL DRIFT" : isW ? "WARNING SHIFT" : "STABLE"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>
                      {isD
                        ? "Distribution shape significantly displaced from baseline"
                        : isW
                        ? "Moderate deviation observed in upper quantiles"
                        : "Within acceptable quantile variation bounds"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
