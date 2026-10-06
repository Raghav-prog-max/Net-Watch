"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Alert, DriftStatus, EvaluationReport } from "@/lib/types";
import { falseAlerts } from "@/lib/falseAlerts";

interface Props {
  alerts: Alert[];
  report: EvaluationReport | null;
  drift: DriftStatus | null;
  falsePositivesTotal?: number | null;
}

const MONO_COLORS = ["#FFFFFF", "#C4C6CB", "#8E909B", "#656773", "#35353F"];

export default function LowerDetailCards({ alerts, report, drift, falsePositivesTotal }: Props) {
  const counts = new Map<string, number>();
  alerts.forEach((a) => counts.set(a.prediction.family, (counts.get(a.prediction.family) ?? 0) + 1));
  const families = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n], i) => ({
      name: name === "Unknown" ? "Unknown" : name,
      fullName: name === "Unknown" ? "Unknown (never seen)" : name,
      rawCount: n,
      count: n.toLocaleString(),
      pct: Math.round((100 * n) / Math.max(alerts.length, 1)),
      color: name === "Unknown" ? "#FFFFFF" : MONO_COLORS[i % MONO_COLORS.length],
    }));

  const falsePositives = falsePositivesTotal ?? alerts.filter((a) => a.status === "false_positive").length;
  const topPsi = drift?.top_features?.[0]?.psi;
  
  const driftLabel = !drift
    ? "DRIFT: —"
    : drift.status === "warming_up"
    ? "WARMING UP"
    : `${drift.status.toUpperCase()}${topPsi !== undefined ? ` (PSI ${topPsi.toFixed(3)})` : ""}`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "16px",
      }}
    >
      {/* ── CARD A: TOP ATTACK FAMILIES ──────────────────────── */}
      <div
        style={{
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#0E0E12",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#8E909B" }}>Top Attack Families</span>
              <div style={{ fontSize: "11px", color: "#656773", marginTop: "2px" }}>
                Among {alerts.length.toLocaleString()} alerts loaded
              </div>
            </div>
            <span style={{
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: "#1A1A20",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 700,
            }}>
              {counts.size} {counts.size === 1 ? "FAMILY" : "FAMILIES"}
            </span>
          </div>

          {families.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#656773", padding: "24px 0", textAlign: "center" }}>
              No alerts yet.
            </div>
          ) : (
            <div style={{ width: "100%", height: "180px", marginTop: "12px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={families}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke="rgba(255,255,255,0.1)"
                    tick={{ fill: "#656773", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    stroke="#E1E4EA"
                    tick={{ fill: "#E1E4EA", fontSize: 11, fontWeight: 500, fontFamily: "var(--font-mono)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.03)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = payload[0].payload as (typeof families)[number];
                      return (
                        <div
                          style={{
                            backgroundColor: "#141418",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "#FFFFFF" }}>{item.fullName}</div>
                          <div style={{ color: "#E1E4EA", marginTop: "4px" }}>
                            {item.count} alerts ({item.pct}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="rawCount" radius={[0, 4, 4, 0]} barSize={14}>
                    {families.map((fam) => (
                      <Cell key={fam.name} fill={fam.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ marginTop: "20px" }}>
          <Link
            href="/evaluation"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "10px",
              borderRadius: "9999px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
          >
            View Evaluation &amp; LOFO Table →
          </Link>
        </div>
      </div>

      {/* ── CARD B: ACTIVE MODEL & DRIFT HEALTH ──────────────── */}
      <div
        style={{
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#0E0E12",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#8E909B" }}>Drift Monitoring &amp; Model Health</span>
              <div style={{ fontSize: "11px", color: "#656773", marginTop: "2px" }}>
                Production pipeline governance
              </div>
            </div>
            <span style={{
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 700,
            }}>
              v4.8.2-PROD
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#141418", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <span style={{ fontSize: "11px", color: "#8E909B" }}>Ensemble Architecture</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#E1E4EA" }}>LightGBM + Isolation Forest</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#141418", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <span style={{ fontSize: "11px", color: "#8E909B" }}>Operating Threshold</span>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "#FFFFFF" }}>
                {report
                  ? (() => {
                      const fa = falseAlerts(report);
                      // the threshold is set from the classifier's share of the whole budget
                      return fa.fromDetectorPer10k == null
                        ? `${report.threshold.threshold.toFixed(3)} (≤ ${fa.budgetPer10k}/10k)`
                        : `${report.threshold.threshold.toFixed(3)} (≤ ${fa.classifierBudgetPer10k} of ${fa.budgetPer10k}/10k)`;
                    })()
                  : "—"}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#141418", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <span style={{ fontSize: "11px", color: "#8E909B" }}>Validation Setup</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#E1E4EA" }}>Temporal Block (No Leakage)</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#141418", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <span style={{ fontSize: "11px", color: "#8E909B" }}>Zero-Day Detection (Recall)</span>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "#FFFFFF" }}>
                {report ? `${((report.novel_families.shown_as_unknown ?? report.novel_families.caught_by_anomaly_detector) * 100).toFixed(1)}%` : "—"}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#141418", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <span style={{ fontSize: "11px", color: "#8E909B" }}>Analyst Retraining Queue</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#E1E4EA" }}>
                {falsePositives} False Positive{falsePositives === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <Link
            href="/drift"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "10px",
              borderRadius: "9999px",
              backgroundColor: "#FFFFFF",
              color: "#000000",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              boxShadow: "0 2px 8px rgba(255, 255, 255, 0.1)",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#E1E4EA")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
          >
            Inspect Drift Monitor &amp; Retrain →
          </Link>
        </div>
      </div>
    </div>
  );
}
