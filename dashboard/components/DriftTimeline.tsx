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

interface HistoryPoint {
  sample: string;
  flows: number;
  time: string;
  feature: string | null;
  psi: number;
}

interface DriftTimelineProps {
  history: HistoryPoint[];
  warnBand: number;
  driftBand: number;
  driftStatus?: string;
  driftFlowsSeen?: number;
}

export function DriftTimeline({ history, warnBand, driftBand, driftStatus, driftFlowsSeen }: DriftTimelineProps) {
  return (
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
          {!driftStatus
            ? "Backend API unreachable. Start `make api` to monitor live distribution PSI."
            : driftStatus === "warming_up"
            ? `Warming up reference window (${driftFlowsSeen} / 500 benign flows observed)...`
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
              stroke="#FFFFFF"
              strokeDasharray="4 4"
              label={{
                value: `DRIFT (${driftBand.toFixed(2)})`,
                position: "insideTopRight",
                fill: "#FFFFFF",
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
                      ? "#FFFFFF"
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
  );
}
