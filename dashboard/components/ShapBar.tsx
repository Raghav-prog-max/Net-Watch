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
import type { Explanation } from "@/lib/types";

export default function ShapBar({ items }: { items: Explanation[] }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ color: "var(--nw-text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
        No explanation telemetry available.
      </div>
    );
  }

  const data = items.map((item) => ({
    feature: item.feature,
    value: item.value,
    impact: Number(item.impact.toFixed(4)),
    absImpact: Math.abs(item.impact),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          width: "100%",
          height: `${Math.max(150, items.length * 46)}px`,
          backgroundColor: "rgba(0, 0, 0, 0.25)",
          borderRadius: "16px",
          padding: "12px 14px 6px 6px",
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 4 }}>
            <CartesianGrid stroke="#26262C" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              stroke="#8A8A93"
              tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "#26262C" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="feature"
              width={135}
              stroke="#F5F5F7"
              tick={{ fill: "#F5F5F7", fontSize: 11, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="#8A8A93" strokeOpacity={0.4} />
            <Tooltip
              cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as (typeof data)[number];
                const isPos = row.impact >= 0;
                return (
                  <div
                    style={{
                      backgroundColor: "#111114",
                      border: "1px solid #2E2E38",
                      borderRadius: "12px",
                      padding: "8px 12px",
                      fontSize: "11px",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#FFFFFF" }}>{row.feature}</div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                      val: {typeof row.value === "number" ? row.value.toLocaleString() : row.value}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: isPos ? "#F4A93E" : "#A78BFA",
                        marginTop: "2px",
                      }}
                    >
                      SHAP impact: {isPos ? "+" : ""}
                      {row.impact.toFixed(3)}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="impact" radius={[4, 4, 4, 4]} barSize={16}>
              {data.map((entry) => (
                <Cell
                  key={entry.feature}
                  fill={entry.impact >= 0 ? "#F4A93E" : "#A78BFA"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
