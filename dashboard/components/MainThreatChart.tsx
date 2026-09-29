"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Alert } from "@/lib/types";

interface MainThreatChartProps {
  alerts: Alert[];
}

interface BucketData {
  timeLabel: string;
  count: number;
  highCritCount: number;
  topFamily: string;
}

export default function MainThreatChart({ alerts }: MainThreatChartProps) {
  const buckets = useMemo<BucketData[]>(() => {
    if (alerts.length === 0) return [];

    // Order chronologically from oldest to newest
    const sorted = [...alerts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const bucketCount = Math.min(8, sorted.length);

    return Array.from({ length: bucketCount }, (_, i) => {
      const startIdx = Math.floor((i * sorted.length) / bucketCount);
      const endIdx = Math.floor(((i + 1) * sorted.length) / bucketCount);
      const slice = sorted.slice(startIdx, Math.max(startIdx + 1, endIdx));

      const famCounts = new Map<string, number>();
      let highCrit = 0;
      for (const al of slice) {
        famCounts.set(al.prediction.family, (famCounts.get(al.prediction.family) ?? 0) + 1);
        if (al.severity.level === "Critical" || al.severity.level === "High") {
          highCrit += 1;
        }
      }

      let topFamily = "Flagged";
      let topCount = 0;
      famCounts.forEach((cnt, fam) => {
        if (cnt > topCount) {
          topCount = cnt;
          topFamily = fam;
        }
      });

      const repTime = slice[slice.length - 1]?.timestamp ?? "";
      const timeLabel = repTime.length >= 19 ? `${repTime.slice(11, 19)} #${i + 1}` : `Window #${i + 1}`;

      return {
        timeLabel,
        count: slice.length,
        highCritCount: highCrit,
        topFamily,
      };
    });
  }, [alerts]);

  return (
    <div
      style={{
        backgroundColor: "var(--nw-bg-panel)",
        borderRadius: "22px",
        padding: "24px 28px",
        position: "relative",
      }}
    >
      {/* ── CHART HEADER ───────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          marginBottom: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
            Threat Traffic &amp; Alert Volume
          </div>
          <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
            {alerts.length > 0
              ? `Computed from ${alerts.length.toLocaleString()} live alerts in the active feed`
              : "Awaiting live alerts from GET /alerts and WS /ws/alerts"}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", fontWeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                backgroundColor: "var(--nw-card-2)",
              }}
            />
            <span style={{ color: "var(--nw-text-primary)" }}>All Flagged Alerts</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                backgroundColor: "var(--nw-card-1)",
              }}
            />
            <span style={{ color: "var(--nw-text-muted)" }}>Critical &amp; High Severity</span>
          </div>
        </div>
      </div>

      {/* ── RECHARTS AREA CHART ────────────────────────────────── */}
      <div style={{ width: "100%", height: "240px", position: "relative" }}>
        {buckets.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 0, 0, 0.22)",
              borderRadius: "16px",
              color: "var(--nw-text-muted)",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              padding: "20px",
              textAlign: "center",
            }}
          >
            No live alerts recorded yet. Run the API and traffic replayer to populate real-time telemetry.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buckets} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="nwPurpleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.35} />
                  <stop offset="90%" stopColor="#A78BFA" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="nwAmberAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F4A93E" stopOpacity={0.25} />
                  <stop offset="90%" stopColor="#F4A93E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#26262C" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timeLabel"
                stroke="#8A8A93"
                tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "#26262C" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="#8A8A93"
                tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as BucketData;
                  return (
                    <div
                      style={{
                        backgroundColor: "#111114",
                        border: "1px solid #2E2E38",
                        borderRadius: "14px",
                        padding: "10px 14px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--nw-text-muted)",
                          marginBottom: "4px",
                        }}
                      >
                        {pt.timeLabel}
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "#FFFFFF" }}>
                        {pt.count} Flagged Alert{pt.count === 1 ? "" : "s"}
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#F4A93E", marginTop: "2px" }}>
                        {pt.highCritCount} Critical / High Severity
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#A78BFA", marginTop: "2px" }}>
                        Top Family: {pt.topFamily}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="All Flagged Alerts"
                stroke="#A78BFA"
                strokeWidth={3}
                fill="url(#nwPurpleAreaGrad)"
                activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#A78BFA", strokeWidth: 3 }}
              />
              <Area
                type="monotone"
                dataKey="highCritCount"
                name="Critical & High Severity"
                stroke="#F4A93E"
                strokeWidth={2.5}
                fill="url(#nwAmberAreaGrad)"
                activeDot={{ r: 5, fill: "#111114", stroke: "#F4A93E", strokeWidth: 2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
