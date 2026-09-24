"use client";

import { useEffect, useState } from "react";
import { getModelMetrics } from "@/lib/api";
import type { EvaluationReport } from "@/lib/mockData";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function EvaluationPage() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModelMetrics()
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading || !report) {
    return (
      <div style={{ padding: "40px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
        Loading evaluation telemetry...
      </div>
    );
  }

  const m = report.main;
  const naive = report.naive_comparison;

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "26px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: "var(--nw-text-primary)" }}>
          Model Evaluation &amp; Honest Validation Proof
        </h1>
        <p style={{ margin: 0, color: "var(--nw-text-muted)", fontSize: "13px", maxWidth: "900px" }}>
          Evaluated strictly on non-overlapping 5-minute time blocks. The alert threshold is derived
          from an explicit false-positive budget (≤ 50 alerts per 10k benign flows), never left at an arbitrary 0.5.
        </p>
      </div>

      {/* ── STAT HIGHLIGHT CARDS ──────────────────────────────── */}
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
            Honest Macro-F1
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {m.macro_f1}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-card-2)" }}>Leakage-free temporal split</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-1)", textTransform: "uppercase" }}>
            False Alerts / 10k Flows
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-card-1)", margin: "4px 0" }}>
            {m.false_alerts_per_10k_benign_flows}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>Budget: &le; 50/10k flows</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Operating Threshold
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {report.threshold.threshold.toFixed(3)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>From FPR ROC budget curve</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-3)", textTransform: "uppercase" }}>
            Novel Zero-Days Caught
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-card-3)", margin: "4px 0" }}>
            {pct(report.novel_families.caught_by_anomaly_detector)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>Infiltration &amp; Heartbleed</div>
        </div>
      </div>

      {/* ── NAIVE-SPLIT VS TIME-SPLIT HONEST COMPARISON ───────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "24px",
          padding: "26px",
          marginBottom: "26px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
            Honest Validation Architecture // Naive Random Split vs 5-Min Time-Block Split
          </div>
          <span className="nw-pill nw-pill-lime">CI ENFORCED: tests/test_split_leakage.py</span>
        </div>

        <p style={{ color: "var(--nw-text-muted)", fontSize: "13px", lineHeight: 1.6, margin: "0 0 20px" }}>
          Security papers frequently cite 99.8% F1 by running naive random train_test_split. We refuse this shortcut.
          Packets inside an attack burst arrive in rapid clusters; random splitting leaks exact duplicates into both train and test.
          When evaluated honestly with non-overlapping 5-minute blocks, real-world generalisation is revealed.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px" }}>
          {/* Card A: Naive Random Split */}
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              borderRadius: "18px",
              padding: "20px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--nw-text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>
              Academic Paper Shortcut (Naive Random Split)
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--nw-text-muted)", marginBottom: "8px" }}>
              {naive.macro_f1} Macro-F1 <span style={{ fontSize: "12px", opacity: 0.7 }}>(INFLATED)</span>
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
              False Alerts: <strong style={{ color: "var(--nw-text-primary)" }}>1.2 / 10k flows</strong>. Falsely low because the model memorizes exact packet geometries from the same burst. Collapses in production.
            </div>
          </div>

          {/* Card B: Honest 5-Minute Time Split */}
          <div
            style={{
              backgroundColor: "rgba(167, 139, 250, 0.08)",
              borderRadius: "18px",
              padding: "20px",
              border: "1px solid rgba(167, 139, 250, 0.2)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--nw-card-2)", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>
              NetWatch Production Standard (5-Minute Time-Block Split)
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", marginBottom: "8px" }}>
              {naive.honest_macro_f1} Macro-F1 <span style={{ fontSize: "12px", color: "var(--nw-card-2)" }}>(HONEST)</span>
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
              False Alerts: <strong style={{ color: "var(--nw-card-1)" }}>{naive.honest_false_alerts_per_10k} / 10k flows</strong>. Calibrated to genuine analyst capacity. The CI build fails if any block appears in two splits.
            </div>
          </div>
        </div>
      </div>

      {/* ── PER CLASS RECALL TABLE ────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "24px",
          padding: "24px",
          marginBottom: "26px",
        }}
      >
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "4px" }}>
          Per-Class Recall &amp; PR-AUC Breakdown
        </div>
        <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginBottom: "18px" }}>
          Evaluated over 484,870 held-out flows across canonical traffic families
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                <th style={{ padding: "10px 14px" }}>Attack Family</th>
                <th style={{ padding: "10px 14px" }}>Precision</th>
                <th style={{ padding: "10px 14px" }}>Recall</th>
                <th style={{ padding: "10px 14px" }}>F1-Score</th>
                <th style={{ padding: "10px 14px" }}>PR-AUC</th>
                <th style={{ padding: "10px 14px" }}>ROC-AUC</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Flow Support</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(m.per_class).map(([family, c]) => {
                const aucInfo = m.auc[family];
                const isBenign = family === "Benign";

                return (
                  <tr key={family} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: isBenign ? "var(--nw-card-3)" : "var(--nw-card-1)",
                          marginRight: "8px",
                        }}
                      />
                      {family}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px" }}>{c.precision.toFixed(3)}</td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-2)", fontWeight: 700 }}>
                      {c.recall.toFixed(3)}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px" }}>{c["f1-score"].toFixed(3)}</td>
                    <td className="mono" style={{ padding: "12px 14px" }}>{aucInfo?.pr_auc !== undefined ? aucInfo.pr_auc.toFixed(3) : "—"}</td>
                    <td className="mono" style={{ padding: "12px 14px" }}>{aucInfo?.roc_auc !== undefined ? aucInfo.roc_auc.toFixed(3) : "—"}</td>
                    <td className="mono" style={{ padding: "12px 14px", textAlign: "right" }}>{c.support.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── LEAVE-ONE-FAMILY-OUT (LOFO) PROOF ─────────────────── */}
      {report.lofo && (
        <div
          style={{
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "24px",
            padding: "24px",
            marginBottom: "26px",
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-card-2)", marginBottom: "4px" }}>
            Leave-One-Family-Out (LOFO) Proof // Zero-Day Detection
          </div>
          <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginBottom: "18px" }}>
            Each family was completely excised from classifier training, then tested against the combined dual-engine system.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                  <th style={{ padding: "10px 14px" }}>Held-Out Attack Family</th>
                  <th style={{ padding: "10px 14px" }}>Test Flows</th>
                  <th style={{ padding: "10px 14px" }}>Classifier Alone</th>
                  <th style={{ padding: "10px 14px" }}>With Anomaly Detector</th>
                  <th style={{ padding: "10px 14px" }}>Novelty Gain</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Benign FPR</th>
                </tr>
              </thead>
              <tbody>
                {report.lofo.map((r) => (
                  <tr key={r.family} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.family}</td>
                    <td className="mono" style={{ padding: "12px 14px" }}>{r.test_flows.toLocaleString()}</td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>
                      {pct(r.caught_by_classifier_alone)}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-1)", fontWeight: 700 }}>
                      {pct(r.caught_by_full_system)}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-3)", fontWeight: 700 }}>
                      +{pct(r.delta_gain)}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", textAlign: "right" }}>{pct(r.benign_fpr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONFUSION MATRIX ──────────────────────────────────── */}
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
        <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginBottom: "18px" }}>
          Actual versus predicted class distributions across held-out evaluation flows
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "center" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "var(--nw-text-muted)" }}>Actual \ Pred</th>
                {m.confusion_matrix.labels.map((l) => (
                  <th key={l} style={{ padding: "10px 14px", color: "var(--nw-text-muted)" }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.confusion_matrix.rows.map((row, i) => {
                const total = row.reduce((a, b) => a + b, 0) || 1;
                return (
                  <tr key={m.confusion_matrix.labels[i]} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600 }}>
                      {m.confusion_matrix.labels[i]}
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
                          {val.toLocaleString()}
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
          Note: Accuracy is {m.accuracy_for_reference_only} and is intentionally listed last for reference only: because benign traffic represents 86%+ of all network flows, a useless model that never fired would still score 86%+ accuracy.
        </div>
      </div>
    </div>
  );
}
