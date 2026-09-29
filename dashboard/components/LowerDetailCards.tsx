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

interface Props {
  alerts: Alert[];
  report: EvaluationReport | null;
  drift: DriftStatus | null;
}

const HEX_COLORS = ["#F4A93E", "#A78BFA", "#C7DB6E"];

export default function LowerDetailCards({ alerts, report, drift }: Props) {
  // families among the alerts on screen, largest first
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
      color: name === "Unknown" ? "#C7DB6E" : HEX_COLORS[i % 2],
    }));
  const falsePositives = alerts.filter((a) => a.status === "false_positive").length;
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
        gap: "20px",
      }}
    >
      {/* ── CARD 1: TOP ATTACK FAMILIES (RECHARTS) ─────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "22px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
                Top Attack Families
              </div>
              <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                Among the {alerts.length.toLocaleString()} alerts loaded
              </div>
            </div>
            <span className="nw-pill nw-pill-amber">{counts.size} {counts.size === 1 ? "FAMILY" : "FAMILIES"}</span>
          </div>

          {families.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", padding: "24px 0" }}>
              No alerts yet.
            </div>
          ) : (
            <div style={{ width: "100%", height: "210px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={families}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke="#26262C" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke="#8A8A93"
                    tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={{ stroke: "#26262C" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    stroke="#F5F5F7"
                    tick={{ fill: "#F5F5F7", fontSize: 12, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = payload[0].payload as (typeof families)[number];
                      return (
                        <div
                          style={{
                            backgroundColor: "#111114",
                            border: "1px solid #2E2E38",
                            borderRadius: "12px",
                            padding: "8px 12px",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: item.color }}>{item.fullName}</div>
                          <div style={{ color: "#FFFFFF", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                            {item.count} alerts ({item.pct}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="rawCount" radius={[0, 8, 8, 0]} barSize={18}>
                    {families.map((fam) => (
                      <Cell key={fam.name} fill={fam.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Colored action button */}
        <div style={{ marginTop: "20px" }}>
          <Link
            href="/evaluation"
            className="nw-btn-pill nw-btn-purple"
            style={{ width: "100%" }}
          >
            View Evaluation &amp; LOFO Table →
          </Link>
        </div>
      </div>

      {/* ── CARD 2: ACTIVE MODEL & DRIFT HEALTH ────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "22px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
                Active Model &amp; Drift Health
              </div>
              <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                Production pipeline governance · v1-prod
              </div>
            </div>
            <span className="nw-pill nw-pill-lime">{driftLabel}</span>
          </div>

          {/* Rows of data */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Ensemble Architecture</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                LightGBM + Isolation Forest
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Operating Threshold</span>
              <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--nw-card-1)" }}>
                {report
                  ? `${report.threshold.threshold.toFixed(3)} (FPR ≤ ${Math.round(report.threshold.fpr_budget * 10000)}/10k)`
                  : "—"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Leakage-Free Validation</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-card-3)" }}>
                5-Min Temporal Block (tests/test_split_leakage.py)
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Never-Seen Shown as Unknown</span>
              <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--nw-card-2)" }}>
                {report
                  ? `${((report.novel_families.shown_as_unknown ?? report.novel_families.caught_by_anomaly_detector) * 100).toFixed(1)}% (held-out test)`
                  : "—"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Analyst Retraining Queue</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                {falsePositives} False Positive{falsePositives === 1 ? "" : "s"} Logged
              </span>
            </div>
          </div>
        </div>

        {/* Colored action button */}
        <div style={{ marginTop: "24px" }}>
          <Link
            href="/drift"
            className="nw-btn-pill nw-btn-lime"
            style={{ width: "100%" }}
          >
            Inspect Drift Monitor &amp; Retrain →
          </Link>
        </div>
      </div>
    </div>
  );
}
