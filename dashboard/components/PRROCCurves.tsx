"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CurveData {
  pr: [number, number][];
  roc: [number, number][];
}

interface PRROCCurvesProps {
  curves: Record<string, CurveData>;
  aucInfo: Record<string, { pr_auc?: number; roc_auc?: number }>;
  curveFamily: string | null;
  setCurveFamily: (f: string) => void;
}

export function PRROCCurves({ curves, aucInfo, curveFamily, setCurveFamily }: PRROCCurvesProps) {
  const fams = Object.keys(curves);
  const fam = curveFamily && fams.includes(curveFamily) ? curveFamily : fams.find((f) => f !== "Benign") ?? fams[0];
  const c = curves[fam];
  const pr = c.pr.map(([x, y]) => ({ x, y }));
  const roc = c.roc.map(([x, y]) => ({ x, y }));

  const chart = (data: { x: number; y: number }[], xl: string, yl: string, color: string) => (
    <div style={{ flex: "1 1 360px", height: "260px", backgroundColor: "#111114", borderRadius: "16px", padding: "12px 12px 4px 0" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
          <CartesianGrid stroke="#26262C" strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" domain={[0, 1]} stroke="#8A8A93" tick={{ fontSize: 10 }}
            label={{ value: xl, position: "insideBottom", offset: -8, fill: "#8A8A93", fontSize: 11 }} />
          <YAxis type="number" domain={[0, 1]} stroke="#8A8A93" tick={{ fontSize: 10 }}
            label={{ value: yl, angle: -90, position: "insideLeft", fill: "#8A8A93", fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: "#17171B", border: "1px solid #2E2E38", borderRadius: "12px", fontSize: "12px" }} />
          <Line type="stepAfter" dataKey="y" stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "24px", marginBottom: "26px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>PR and ROC Curves // {fam}</div>
          <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
            One-vs-rest on the held-out test set. Read PR first: ROC flatters imbalanced data.
            PR-AUC {aucInfo[fam]?.pr_auc?.toFixed(3) ?? "—"} · ROC-AUC {aucInfo[fam]?.roc_auc?.toFixed(3) ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {fams.map((f) => (
            <button key={f} onClick={() => setCurveFamily(f)} className={`nw-btn-pill ${f === fam ? "nw-btn-purple" : "nw-btn-dark"}`}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {chart(pr, "Recall", "Precision", "#FFFFFF")}
        {chart(roc, "False positive rate", "True positive rate", "#A78BFA")}
      </div>
    </div>
  );
}
