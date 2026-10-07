"use client";

import { useState } from "react";

interface ConfusionMatrixProps {
  labels: string[];
  rows: number[][];
  accuracyForReferenceOnly: number;
}

export function ConfusionMatrix({ labels, rows, accuracyForReferenceOnly }: ConfusionMatrixProps) {
  const [cmCounts, setCmCounts] = useState(false);

  return (
    <div
      style={{
        backgroundColor: "var(--nw-bg-panel)",
        borderRadius: "24px",
        padding: "24px",
      }}
    >
      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "4px" }}>
        Confusion Matrix Heatmap
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "18px" }}>
        <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
          {cmCounts ? "Flow counts" : "Row-normalised: share of each actual class"} across held-out evaluation flows
        </div>
        <button onClick={() => setCmCounts(!cmCounts)} className="nw-btn-pill nw-btn-dark">
          {cmCounts ? "Show row %" : "Show counts"}
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "center" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #26262C" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "var(--nw-text-muted)" }}>Actual \\ Pred</th>
              {labels.map((l) => (
                <th key={l} style={{ padding: "10px 14px", color: "var(--nw-text-muted)" }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const total = row.reduce((a, b) => a + b, 0) || 1;
              return (
                <tr key={labels[i]} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600 }}>
                    {labels[i]}
                  </td>
                  {row.map((val, j) => {
                    const frac = val / total;
                    const isDiag = i === j;
                    return (
                      <td
                        key={j}
                        className="mono"
                        style={{
                          padding: "12px 14px",
                          backgroundColor: isDiag ? `rgba(167, 139, 250, ${0.12 + frac * 0.35})` : "transparent",
                          color: isDiag ? "#FFFFFF" : "var(--nw-text-muted)",
                          fontWeight: isDiag ? 700 : 400,
                        }}
                      >
                        {cmCounts ? val.toLocaleString() : `${(frac * 100).toFixed(1)}%`}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "16px", fontSize: "12px", color: "var(--nw-text-muted)", borderTop: "1px solid #26262C", paddingTop: "12px" }}>
        Note: Accuracy is {accuracyForReferenceOnly} and is intentionally listed last for reference only: because most network flows are benign, a useless model that never fired would still score a high accuracy.
      </div>
    </div>
  );
}
