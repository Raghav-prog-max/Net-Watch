"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
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

type TimeRange = "1H" | "6H" | "24H" | "7D";

const RANGE_DURATIONS: Record<TimeRange, number> = {
  "1H": 1 * 60 * 60 * 1000,
  "6H": 6 * 60 * 60 * 1000,
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
};

interface MainThreatChartProps {
  alerts: Alert[];
}

interface BucketData {
  timeLabel: string;
  count: number;
  highCritCount: number;
  topFamily: string;
}

/** Mapping from button label to the number of hours it represents. */
const RANGE_OPTIONS = [
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
  { label: "7D", hours: 24 * 7 },
] as const;

type RangeLabel = (typeof RANGE_OPTIONS)[number]["label"];

export default function MainThreatChart({ alerts }: MainThreatChartProps) {
  const [activeRange, setActiveRange] = useState<RangeLabel>("24H");

  /** The cutoff timestamp: only alerts newer than this are shown. */
  const cutoffMs = useMemo(() => {
    const hours = RANGE_OPTIONS.find((r) => r.label === activeRange)!.hours;
    return Date.now() - hours * 60 * 60 * 1000;
  }, [activeRange]);

  /** Alerts filtered to the active time range. */
  const filteredAlerts = useMemo(
    () => alerts.filter((a) => new Date(a.timestamp).getTime() >= cutoffMs),
    [alerts, cutoffMs],
  );

  const buckets = useMemo<BucketData[]>(() => {
    if (filteredAlerts.length === 0) return [];

    const duration = RANGE_DURATIONS[selectedRange];
    const timestamps = alerts
      .map((a) => new Date(a.timestamp).getTime())
      .filter((t) => !isNaN(t));

    if (timestamps.length === 0) return alerts;

    const maxTime = Math.max(...timestamps);
    const now = Date.now();
    // Anchor to now if recent/live, or anchor to newest alert for offline/seeded demos
    const anchor = Math.abs(now - maxTime) < 24 * 60 * 60 * 1000 && now >= maxTime ? now : maxTime;
    const cutoff = anchor - duration;

    return alerts.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }, [alerts, selectedRange]);

  const buckets = useMemo<BucketData[]>(() => {
    if (filteredAlerts.length === 0) return [];

    // Order chronologically from oldest to newest
    const sorted = [...filteredAlerts].sort(
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
      let timeLabel = `Window #${i + 1}`;
      if (repTime.length >= 19) {
        if (selectedRange === "7D") {
          timeLabel = `${repTime.slice(5, 10)} ${repTime.slice(11, 16)} #${i + 1}`;
        } else {
          timeLabel = `${repTime.slice(11, 19)} #${i + 1}`;
        }
      }

      return {
        timeLabel,
        count: slice.length,
        highCritCount: highCrit,
        topFamily,
      };
    });
  }, [filteredAlerts]);

  /** Style helper: returns pill styles for active vs inactive range button. */
  const pillStyle = (label: RangeLabel): React.CSSProperties =>
    label === activeRange
      ? { padding: "4px 12px", borderRadius: "9999px", background: "#FFFFFF", color: "#000000", fontWeight: 600, border: "none", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", cursor: "pointer" }
      : { padding: "4px 12px", borderRadius: "9999px", background: "transparent", color: "#8E909B", border: "none", cursor: "pointer" };

  return (
    <div
      style={{
        backgroundColor: "#0E0E12",
        borderRadius: "16px",
        padding: "24px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* ── CHART HEADER ───────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em", margin: 0 }}>
            Network Alert Volume &amp; Severity Distribution
          </h2>
          <p style={{ fontSize: "12px", color: "#8E909B", margin: "2px 0 0" }}>
            {filteredAlerts.length > 0
              ? `Real-time aggregate ingress packets scrutinized across edge gateways`
              : alerts.length > 0
                ? `No alerts in the last ${activeRange} window — try a wider range`
                : "Awaiting live alerts from GET /alerts and WS /ws/alerts"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Range Selector Pills */}
          <div style={{ display: "flex", backgroundColor: "#050508", padding: "4px", borderRadius: "9999px", border: "1px solid rgba(255, 255, 255, 0.1)", fontSize: "12px" }}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setActiveRange(opt.label)}
                style={pillStyle(opt.label)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#FFFFFF" }} /> Critical/High
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#8E909B" }} /> All Flagged
            </div>
          </div>
        </div>
      </div>

      {/* ── RECHARTS AREA CHART ────────────────────────────────── */}
      <div style={{ width: "100%", height: "256px", position: "relative", marginTop: "4px" }}>
        {buckets.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderRadius: "12px",
              color: "#656773",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              padding: "20px",
              textAlign: "center",
            }}
          >
            {alerts.length > 0
              ? `No alerts match the ${activeRange} window. Try a wider range (e.g. 7D).`
              : "No live alerts recorded yet. Run the API and traffic replayer."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buckets} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="whiteGlow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="slateGlow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#8E909B" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#8E909B" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timeLabel"
                stroke="rgba(255, 255, 255, 0.12)"
                tick={{ fill: "#656773", fontSize: 11, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "rgba(255, 255, 255, 0.12)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="rgba(255, 255, 255, 0.12)"
                tick={{ fill: "#656773", fontSize: 11, fontFamily: "var(--font-mono)" }}
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
                        backgroundColor: "#141418",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "12px",
                        padding: "12px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontFamily: "var(--font-mono)",
                          color: "#8E909B",
                          marginBottom: "4px",
                        }}
                      >
                        {pt.timeLabel}
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>
                        {pt.count} Flagged Alert{pt.count === 1 ? "" : "s"}
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF", marginTop: "2px" }}>
                        {pt.highCritCount} Critical / High Severity
                      </div>
                      <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "#E1E4EA", marginTop: "6px" }}>
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
                stroke="#8E909B"
                strokeWidth={2}
                fill="url(#slateGlow)"
                activeDot={{ r: 4, fill: "#8E909B", stroke: "#0E0E12", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="highCritCount"
                name="Critical & High Severity"
                stroke="#FFFFFF"
                strokeWidth={2}
                fill="url(#whiteGlow)"
                activeDot={{ r: 5, fill: "#FFFFFF", stroke: "#FFFFFF", strokeWidth: 1.5, strokeOpacity: 0.4, strokeDasharray: "0" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
