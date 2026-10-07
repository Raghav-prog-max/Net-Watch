"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LOFOChartProps {
  data: {
    family: string;
    "Classifier Alone": number;
    "Hybrid Ensemble": number;
  }[];
}

export function LOFOChart({ data }: LOFOChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div
      style={{
        width: "100%",
        height: "220px",
        backgroundColor: "#111114",
        borderRadius: "16px",
        padding: "16px 16px 8px 4px",
        marginBottom: "20px",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#26262C" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="family"
            stroke="#8A8A93"
            tick={{ fill: "#F5F5F7", fontSize: 11, fontWeight: 600 }}
            axisLine={{ stroke: "#26262C" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            stroke="#8A8A93"
            tick={{ fill: "#8A8A93", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
            contentStyle={{
              backgroundColor: "#17171B",
              border: "1px solid #2E2E38",
              borderRadius: "12px",
              fontSize: "12px",
              color: "#FFFFFF",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
          <Bar dataKey="Classifier Alone" fill="#A78BFA" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="Hybrid Ensemble" fill="#FFFFFF" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
