"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDrift } from "@/lib/api";
import type { DriftStatus } from "@/lib/types";

interface HistoryPoint {
  sample: string;       // x-axis label: flows scored when the snapshot was taken
  flows: number;
  time: string;
  feature: string | null;
  psi: number;
}

function formatFlows(n: number): string {
  return n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : String(n);
}

export default function DriftMonitorPage() {
  const [drift, setDrift] = useState<DriftStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchDrift = () => {
      getDrift()
        .then((d) => {
          if (!mounted) return;
          setError(null);
          setDrift(d);
        })
        .catch((e) => {
          if (!mounted) return;
          setError(e instanceof Error ? e.message : "Could not reach GET /metrics/drift");
        });
    };

    fetchDrift();
    const interval = setInterval(fetchDrift, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const isDrift = drift?.status === "drift" || (drift?.top_features?.[0]?.psi ?? 0) >= 0.25;
  const isWarn = drift?.status === "warning";
  const warnBand = drift?.bands?.warning ?? 0.1;
  const driftBand = drift?.bands?.drift ?? 0.25;
  const topFeatures = drift?.top_features ?? [];
  // The API keeps the history, so the chart shows the whole run however late the
  // page is opened. Snapshots taken while warming up have no PSI and are skipped.
  const history: HistoryPoint[] = (drift?.history ?? []).flatMap((h) =>
    h.max_psi === null
      ? []
      : [{
          sample: formatFlows(h.flows_scored),
          flows: h.flows_scored,
          time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          feature: h.top_feature,
          psi: h.max_psi,
        }]
  );

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
          <div style={{ marginTop: "10px" }}>
            <span className={`nw-pill ${error ? "nw-pill-amber" : "nw-pill-purple"}`} style={{ fontSize: "10px" }}>
              {error ? `API OFFLINE · ${error}` : "LIVE · GET /metrics/drift"}
            </span>
          </div>
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
              Monitored features exceed critical threshold (PSI &ge; {driftBand.toFixed(2)}). The underlying network distribution
              has statistically drifted from training baselines. Retraining is a human decision and runs offline:
              <code style={{ margin: "0 4px" }}>make train</code>, then restart the API. It is not triggered from this page.
            </div>
          </div>
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
                !drift
                  ? "nw-pill-purple"
                  : isDrift
                  ? "nw-pill-amber"
                  : isWarn
                  ? "nw-pill-purple"
                  : "nw-pill-lime"
              }`}
              style={{ fontSize: "12px", padding: "5px 14px" }}
            >
              {drift ? drift.status.toUpperCase() : "OFFLINE"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            {!drift
              ? "Awaiting backend connection"
              : isDrift
              ? "Retrain recommended"
              : drift.status === "warming_up"
              ? "Collecting 500 benign flows"
              : "Operating within limits"}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Benign Window Flows
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {drift ? (drift.flows_seen ?? 0).toLocaleString() : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-card-2)" }}>Unflagged flows evaluated</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Window Alert Rate
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {drift?.alert_rate !== undefined ? `${(drift.alert_rate * 100).toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>Fraction of flows alerted</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            PSI Thresholds
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-text-primary)", margin: "10px 0 4px" }}>
            Warning: <span style={{ color: "var(--nw-card-2)" }}>&ge;{warnBand.toFixed(2)}</span> · Drift: <span style={{ color: "var(--nw-card-1)" }}>&ge;{driftBand.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>10-quantile bin boundaries</div>
        </div>
      </div>

      {/* ── HIGHEST PSI OVER TIME TIMELINE (RECHARTS) ─────────── */}
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
              One bar per API snapshot, labelled by flows scored. Dashed reference lines mark Warning ({warnBand.toFixed(2)}) and Critical Drift ({driftBand.toFixed(2)}) thresholds
            </div>
          </div>
        </div>

        <div style={{ width: "100%", height: "210px", backgroundColor: "#111114", borderRadius: "16px", padding: "16px", position: "relative" }}>
          {history.length === 0 ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--nw-text-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              {!drift
                ? "Backend API unreachable. Start `make api` to monitor live distribution PSI."
                : drift.status === "warming_up"
                ? `Warming up reference window (${drift.flows_seen} / 500 benign flows observed)...`
                : "Waiting for the API's first drift snapshot..."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#26262C" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="sample"
                  stroke="#8A8A93"
                  tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={{ stroke: "#26262C" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, (dataMax: number) => Math.max(Number((dataMax * 1.15).toFixed(2)), 0.35)]}
                  stroke="#8A8A93"
                  tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine
                  y={warnBand}
                  stroke="#A78BFA"
                  strokeDasharray="3 3"
                  label={{
                    value: `WARN (${warnBand.toFixed(2)})`,
                    position: "insideTopRight",
                    fill: "#A78BFA",
                    fontSize: 10,
                  }}
                />
                <ReferenceLine
                  y={driftBand}
                  stroke="#F4A93E"
                  strokeDasharray="4 4"
                  label={{
                    value: `DRIFT (${driftBand.toFixed(2)})`,
                    position: "insideTopRight",
                    fill: "#F4A93E",
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const pt = payload[0].payload as HistoryPoint;
                    return (
                      <div
                        style={{
                          backgroundColor: "#17171B",
                          border: "1px solid #2E2E38",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          fontSize: "11px",
                        }}
                      >
                        <div style={{ fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
                          {pt.flows.toLocaleString()} flows scored · {pt.time}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#FFFFFF", marginTop: "2px" }}>
                          Max PSI: {pt.psi.toFixed(4)}
                        </div>
                        {pt.feature && (
                          <div style={{ fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                            {pt.feature}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="psi" radius={[6, 6, 0, 0]} maxBarSize={28}>
                  {history.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.psi >= driftBand
                          ? "#F4A93E"
                          : entry.psi >= warnBand
                          ? "#A78BFA"
                          : "#C7DB6E"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {drift?.recommendation && (
          <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--nw-text-muted)" }}>
            {drift.recommendation}
          </div>
        )}
      </div>

      {/* ── TOP MONITORED FEATURES CHART + TABLE ──────────────── */}
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

        {topFeatures.length > 0 && (
          <div
            style={{
              width: "100%",
              height: `${Math.max(180, topFeatures.length * 42)}px`,
              backgroundColor: "#111114",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFeatures} layout="vertical" margin={{ top: 6, right: 20, left: 10, bottom: 6 }}>
                <CartesianGrid stroke="#26262C" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, (dataMax: number) => Math.max(Number((dataMax * 1.15).toFixed(2)), 0.35)]}
                  stroke="#8A8A93"
                  tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={{ stroke: "#26262C" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={155}
                  stroke="#F5F5F7"
                  tick={{ fill: "#F5F5F7", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine x={warnBand} stroke="#A78BFA" strokeDasharray="3 3" />
                <ReferenceLine x={driftBand} stroke="#F4A93E" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as { feature: string; psi: number };
                    return (
                      <div
                        style={{
                          backgroundColor: "#17171B",
                          border: "1px solid #2E2E38",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          fontSize: "11px",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#FFFFFF" }}>{row.feature}</div>
                        <div style={{ fontFamily: "var(--font-mono)", color: "#A78BFA", marginTop: "2px" }}>
                          PSI: {row.psi.toFixed(4)}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="psi" radius={[0, 6, 6, 0]} barSize={16}>
                  {topFeatures.map((f) => (
                    <Cell
                      key={f.feature}
                      fill={
                        f.psi >= driftBand
                          ? "#F4A93E"
                          : f.psi >= warnBand
                          ? "#A78BFA"
                          : "#C7DB6E"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

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
              {topFeatures.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "20px 14px", color: "var(--nw-text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    No feature PSI measurements available yet. At least 500 unflagged benign flows are required to compute quantile bin shifts.
                  </td>
                </tr>
              ) : (
                topFeatures.map((f) => {
                  const isD = f.psi >= driftBand;
                  const isW = f.psi >= warnBand && f.psi < driftBand;

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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
