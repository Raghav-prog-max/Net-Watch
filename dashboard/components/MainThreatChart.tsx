"use client";

import { useState } from "react";

export default function MainThreatChart() {
  const [activeRange, setActiveRange] = useState<"Weekly" | "Monthly" | "24H">("Weekly");
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(4); // default spike point (Friday peak)

  // Points: X: 40 to 680, Y: 40 to 190 (inverted)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Weekly data points
  const purplePoints = [
    { x: 50, y: 150, val: "3.2K", label: "Normal Ingestion" },
    { x: 150, y: 135, val: "4.8K", label: "Routine Probes" },
    { x: 250, y: 110, val: "7.1K", label: "PortScan Burst" },
    { x: 350, y: 140, val: "5.4K", label: "Benign Shift" },
    { x: 450, y: 48, val: "14.2K", label: "DDoS Attack Spike" }, // The highlighted spike
    { x: 550, y: 105, val: "6.9K", label: "WebAttack Probe" },
    { x: 650, y: 125, val: "4.1K", label: "Stable Baseline" },
  ];

  const amberPoints = [
    { x: 50, y: 165 },
    { x: 150, y: 155 },
    { x: 250, y: 140 },
    { x: 350, y: 120 },
    { x: 450, y: 115 },
    { x: 550, y: 130 },
    { x: 650, y: 145 },
  ];

  // Generate smooth SVG cubic Bézier paths
  const purplePath = "M 50 150 C 100 145, 120 135, 150 135 C 190 135, 210 110, 250 110 C 290 110, 310 140, 350 140 C 400 140, 420 48, 450 48 C 480 48, 510 105, 550 105 C 590 105, 620 125, 650 125";
  const purpleArea = `${purplePath} L 650 200 L 50 200 Z`;

  const amberPath = "M 50 165 C 100 160, 120 155, 150 155 C 190 155, 210 140, 250 140 C 290 140, 310 120, 350 120 C 400 120, 420 115, 450 115 C 480 115, 510 130, 550 130 C 590 130, 620 145, 650 145";

  const selectedPoint = hoveredPoint !== null ? purplePoints[hoveredPoint] : purplePoints[4];

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
            Threat Traffic &amp; Ingestion Volume
          </div>
          <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
            Real-time dual-engine packet flow monitoring · 40 flows/sec
          </div>
        </div>

        {/* Legend & Date Range */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Legend dots */}
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
              <span style={{ color: "var(--nw-text-primary)" }}>Flagged Attacks</span>
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
              <span style={{ color: "var(--nw-text-muted)" }}>Benign Baseline</span>
            </div>
          </div>

          {/* Timeframe pill selector */}
          <div
            style={{
              display: "flex",
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              borderRadius: "9999px",
              padding: "3px",
            }}
          >
            {(["24H", "Weekly", "Monthly"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setActiveRange(range)}
                style={{
                  border: "none",
                  outline: "none",
                  backgroundColor: activeRange === range ? "var(--nw-card-circle)" : "transparent",
                  color: activeRange === range ? "#FFFFFF" : "var(--nw-text-muted)",
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN SVG CHART CANVAS ──────────────────────────────── */}
      <div style={{ width: "100%", height: "230px", position: "relative" }}>
        <svg
          viewBox="0 0 700 230"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <defs>
            {/* Primary line gradient fill */}
            <linearGradient id="purpleGlowFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.28" />
              <stop offset="85%" stopColor="#A78BFA" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.0" />
            </linearGradient>

            {/* Tooltip drop shadow */}
            <filter id="tooltipShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Subtle horizontal grid lines */}
          <line x1="40" y1="50" x2="660" y2="50" stroke="var(--nw-line)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="100" x2="660" y2="100" stroke="var(--nw-line)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="150" x2="660" y2="150" stroke="var(--nw-line)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="200" x2="660" y2="200" stroke="var(--nw-line)" strokeWidth="1" />

          {/* Soft area fill under purple primary line */}
          <path d={purpleArea} fill="url(#purpleGlowFill)" />

          {/* Secondary Line: Amber (#F4A93E) */}
          <path
            d={amberPath}
            fill="none"
            stroke="var(--nw-card-1)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Primary Line: Purple (#A78BFA) */}
          <path
            d={purplePath}
            fill="none"
            stroke="var(--nw-card-2)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Highlighted vertical spike line */}
          <line
            x1={selectedPoint.x}
            y1={selectedPoint.y}
            x2={selectedPoint.x}
            y2="200"
            stroke="var(--nw-card-2)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />

          {/* Highlighted Spike Dot */}
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r="6"
            fill="#FFFFFF"
            stroke="var(--nw-card-2)"
            strokeWidth="3.5"
          />

          {/* Interactive clickable node points */}
          {purplePoints.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r="12"
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredPoint(idx)}
            />
          ))}

          {/* ── HIGHLIGHTED DATA-POINT TOOLTIP (matching reference "30L" / "7L") ── */}
          <g
            transform={`translate(${Math.min(Math.max(selectedPoint.x - 55, 10), 580)}, ${Math.max(
              selectedPoint.y - 48,
              4
            )})`}
            filter="url(#tooltipShadow)"
            style={{ pointerEvents: "none", transition: "transform 0.2s ease" }}
          >
            {/* Tooltip Background Pill */}
            <rect
              x="0"
              y="0"
              width="110"
              height="38"
              rx="19"
              fill="#111114"
              stroke="#2E2E38"
              strokeWidth="1"
            />
            {/* Value (e.g. 14.2K) */}
            <text
              x="55"
              y="18"
              textAnchor="middle"
              fill="#FFFFFF"
              fontFamily="var(--font-sans)"
              fontSize="12"
              fontWeight="800"
            >
              {selectedPoint.val}
            </text>
            {/* Label (e.g. DDoS Spike) */}
            <text
              x="55"
              y="30"
              textAnchor="middle"
              fill="var(--nw-card-2)"
              fontFamily="var(--font-sans)"
              fontSize="9"
              fontWeight="600"
            >
              {selectedPoint.label}
            </text>
          </g>

          {/* X-axis day labels */}
          {days.map((d, i) => (
            <text
              key={d}
              x={purplePoints[i].x}
              y="222"
              textAnchor="middle"
              fill="var(--nw-text-muted)"
              fontFamily="var(--font-sans)"
              fontSize="11"
              fontWeight="500"
            >
              {d}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
