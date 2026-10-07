"use client";

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

interface TopFeature {
  feature: string;
  psi: number;
}

interface DriftFeaturesBarProps {
  topFeatures: TopFeature[];
  warnBand: number;
  driftBand: number;
}

export function DriftFeaturesBar({ topFeatures, warnBand, driftBand }: DriftFeaturesBarProps) {
  if (topFeatures.length === 0) return null;

  return (
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
          <ReferenceLine x={driftBand} stroke="#FFFFFF" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const row = payload[0].payload as TopFeature;
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
                    ? "#FFFFFF"
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
  );
}
