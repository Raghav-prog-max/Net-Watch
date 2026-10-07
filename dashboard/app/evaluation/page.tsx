"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getModelMetrics } from "@/lib/api";
import { isLofoResult, type EvaluationReport } from "@/lib/types";
import { falseAlerts, falseAlertsBreakdown } from "@/lib/falseAlerts";
import { ConfusionMatrix } from "@/components/ConfusionMatrix";
import { PRROCCurves } from "@/components/PRROCCurves";
import { PerClassMetrics } from "@/components/PerClassMetrics";
import { LOFOChart } from "@/components/LOFOChart";
import { supportText } from "@/lib/support";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function EvaluationPage() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [curveFamily, setCurveFamily] = useState<string | null>(null);

  useEffect(() => {
    getModelMetrics()
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load evaluation report from GET /metrics/model");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
        Loading evaluation telemetry...
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: "var(--nw-text-primary)" }}>
          Model Evaluation &amp; Honest Validation Proof
        </h1>
        <div
          style={{
            marginTop: "20px",
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "20px",
            padding: "24px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            color: "var(--nw-card-1)",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
          }}
        >
          ▲ {error ?? "Evaluation report unavailable."} — Ensure the backend API is running (`make api`) and `reports/metrics.json` has been generated (`make train`).
        </div>
      </div>
    );
  }

  const m = report.main;
  const naive = report.naive_comparison;
  // the headline is the whole system; `m` (and the comparisons below) is the classifier alone
  const fa = falseAlerts(report);
  const novel = report.novel_families || { families: [], flows: 0, caught_by_anomaly_detector: 0 };
  const novelShown = novel.shown_as_unknown ?? novel.caught_by_anomaly_detector;

  const perClassChartData = Object.entries(m.per_class).map(([family, c]) => ({
    family,
    Precision: Number((c.precision * 100).toFixed(1)),
    Recall: Number((c.recall * 100).toFixed(1)),
    F1: Number((c["f1-score"] * 100).toFixed(1)),
  }));

  // only families with figures: a note row (no test flows) has nothing to plot
  const lofoChartData = (report.lofo ?? []).filter(isLofoResult).map((r) => ({
    // the flow count beside the name: a rate from 23 flows is not one from 1,000
    family: `${r.family} (n=${r.test_flows.toLocaleString()})`,
    "Classifier Alone": Number((r.caught_by_classifier_alone * 100).toFixed(1)),
    "Hybrid Ensemble": Number((r.caught_by_full_system * 100).toFixed(1)),
  }));

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "26px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: "var(--nw-text-primary)" }}>
          Model Evaluation &amp; Honest Validation Proof
        </h1>
        <p style={{ margin: 0, color: "var(--nw-text-muted)", fontSize: "13px", maxWidth: "900px" }}>
          Evaluated strictly on non-overlapping 5-minute time blocks. Alert thresholds are derived
          from an explicit false-alert budget (≤ {fa.budgetPer10k} per 10k benign flows
          {fa.fromDetectorPer10k != null && `, ${fa.classifierBudgetPer10k} of them for the classifier and the rest for the anomaly detector`}),
          never left at an arbitrary 0.5.
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
          <span className="nw-pill nw-pill-purple" style={{ fontSize: "10px" }}>
            LIVE · GET /metrics/model
            {report.generated ? ` · ${report.generated.slice(0, 10)}` : ""}
          </span>
          {report.synthetic_data && (
            <span className="nw-pill nw-pill-lime" style={{ fontSize: "10px" }}>
              SYNTHETIC DATA · real CIC-IDS2017 results pending
            </span>
          )}
        </div>
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
            {fa.per10k}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>{falseAlertsBreakdown(fa)}</div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Operating Threshold
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {report.threshold.threshold.toFixed(3)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            Classifier, chosen on validation for ≤ {fa.classifierBudgetPer10k}/10k:{" "}
            {(report.threshold.fpr_at_threshold * 10000).toFixed(1)}/10k false alerts,{" "}
            {(report.threshold.recall_at_threshold * 100).toFixed(1)}% of attacks caught
          </div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-3)", textTransform: "uppercase" }}>
            Never-Seen Attacks Shown as Unknown
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-card-3)", margin: "4px 0" }}>
            {pct(novelShown)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            {(novel.families || []).join(" & ")} · {(novel.flows ?? 0).toLocaleString()} flows
            {novel.alerted !== undefined ? ` · ${pct(novel.alerted)} alerted` : ""}
          </div>
          {supportText(novel.shown_as_unknown_support) && (
            <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
              {supportText(novel.shown_as_unknown_support)}
            </div>
          )}
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
          <span className="nw-pill nw-pill-lime">TESTED: tests/test_split_leakage.py</span>
        </div>

        <p style={{ color: "var(--nw-text-muted)", fontSize: "13px", lineHeight: 1.6, margin: "0 0 20px" }}>
          Flows inside one attack burst tend to be near-identical. A random train_test_split can put copies of the
          same burst in both train and test, so the model is graded on flows it has effectively already seen.
          We split by non-overlapping 5-minute blocks instead, so every test flow comes from a time the model never trained on.
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
              Same Model, Naive Random Split
            </div>
            {naive ? (
              <>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--nw-text-muted)", marginBottom: "8px" }}>
                  {naive.macro_f1} Macro-F1{" "}
                  <span style={{ fontSize: "12px", opacity: 0.7 }}>
                    {naive.inflated ? "(INFLATED)" : "(NO INFLATION MEASURED)"}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
                  Classifier false alerts: <strong style={{ color: "var(--nw-text-primary)" }}>{naive.false_alerts_per_10k} / 10k flows</strong>.
                  {naive.macro_f1_over_seeds &&
                    ` Range over ${naive.macro_f1_over_seeds.seeds} random splits: ${naive.macro_f1_over_seeds.min}–${naive.macro_f1_over_seeds.max}.`}
                  {naive.test_flows_from_blocks_seen_in_training != null &&
                    ` ${Math.round(naive.test_flows_from_blocks_seen_in_training * 100)}% of its test flows come from time blocks also used in training.`}
                  {naive.inflated
                    ? " Every random split scores higher: that gap is what a leaky evaluation would have claimed."
                    : report.synthetic_data
                    ? " On this synthetic data the leak did not raise the score: its bursts are not near-duplicates. To be re-measured on CIC-IDS2017."
                    : " On this data the leak did not raise the score."}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--nw-text-muted)", marginBottom: "8px" }}>
                  Not measured yet
                </div>
                <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
                  The training run has not produced a naive-split comparison, so there is no number to show here.
                </div>
              </>
            )}
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
              {m.macro_f1} Macro-F1 <span style={{ fontSize: "12px", color: "var(--nw-card-2)" }}>(HONEST)</span>
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
              Classifier false alerts: <strong style={{ color: "var(--nw-card-1)" }}>{m.false_alerts_per_10k_benign_flows} / 10k flows</strong>,
              the same model and measure as the naive split ({fa.per10k}/10k with the anomaly detector). The test
              suite fails if any block appears in two splits.
            </div>
          </div>
        </div>
      </div>

      {/* ── PER CLASS RECALL CHART + TABLE (RECHARTS) ─────────── */}
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
          {report.rows
            ? `Evaluated over ${(report.rows.test ?? 0).toLocaleString()} held-out flows from time blocks the model never trained on`
            : "Evaluated over held-out time blocks the model never trained on"}
        </div>

        {/* Recharts Grouped BarChart */}
        <PerClassMetrics data={perClassChartData} />

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
                    <td className="mono" style={{ padding: "12px 14px", textAlign: "right" }}>{(c.support ?? 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── LEAVE-ONE-FAMILY-OUT (LOFO) PROOF (RECHARTS) ──────── */}
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

          <LOFOChart data={lofoChartData} />

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
                {report.lofo.map((r) => !isLofoResult(r) ? (
                  <tr key={r.family} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.family}</td>
                    <td colSpan={5} style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>{r.note}</td>
                  </tr>
                ) : (
                  <tr key={r.family} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.family}</td>
                    <td className="mono" style={{ padding: "12px 14px" }}>{r.test_flows.toLocaleString()}</td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>
                      {pct(r.caught_by_classifier_alone)}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-1)", fontWeight: 700 }}>
                      {pct(r.caught_by_full_system)}
                      {supportText(r.caught_by_full_system_support) && (
                        <div style={{ fontSize: "10px", fontWeight: 400, color: "var(--nw-text-muted)" }}>
                          {supportText(r.caught_by_full_system_support)}
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-3)", fontWeight: 700 }}>
                      +{pct(r.caught_by_full_system - r.caught_by_classifier_alone)}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", textAlign: "right" }}>{pct(r.benign_fpr)}</td>
                  </tr>
                ))}
                {report.novel_families && (
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)", backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                      {report.novel_families.families.join(" + ")}{" "}
                      <span style={{ color: "var(--nw-text-muted)", fontWeight: 400 }}>(never trained)</span>
                    </td>
                    <td className="mono" style={{ padding: "12px 14px" }}>{(report.novel_families?.flows ?? 0).toLocaleString()}</td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>—</td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-1)", fontWeight: 700 }}>
                      {report.novel_families.alerted !== undefined ? pct(report.novel_families.alerted) : "—"}
                      {supportText(report.novel_families.alerted_support) && (
                        <div style={{ fontSize: "10px", fontWeight: 400, color: "var(--nw-text-muted)" }}>
                          {supportText(report.novel_families.alerted_support)}
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-3)" }}>
                      {report.novel_families.shown_as_unknown !== undefined
                        ? `${pct(report.novel_families.shown_as_unknown)} as Unknown`
                        : "—"}
                      {supportText(report.novel_families.shown_as_unknown_support) && (
                        <div style={{ fontSize: "10px", color: "var(--nw-text-muted)" }}>
                          {supportText(report.novel_families.shown_as_unknown_support)}
                        </div>
                      )}
                      {report.novel_families.per_family?.map((f) => (
                        <div key={f.family} style={{ fontSize: "10px", color: "var(--nw-text-muted)" }}>
                          {f.family}: {supportText(f.shown_as_unknown_support)}
                        </div>
                      ))}
                    </td>
                    <td className="mono" style={{ padding: "12px 14px", textAlign: "right" }}>{pct(fa.falsePositiveRate)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PR AND ROC CURVES ─────────────────────────────────── */}
      {m.curves && Object.keys(m.curves).length > 0 && (
        <PRROCCurves
          curves={m.curves as Record<string, any>}
          aucInfo={m.auc as Record<string, any>}
          curveFamily={curveFamily}
          setCurveFamily={setCurveFamily}
        />
      )}

      {/* ── MODEL COMPARISON ──────────────────────────────────── */}
      {(report.random_forest_baseline || report.imbalance_study) && (
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "24px", marginBottom: "26px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "4px" }}>Model Comparison</div>
          <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginBottom: "16px" }}>
            The chosen model beside the alternatives it was picked over, including the ones that lost.
          </div>
          {report.random_forest_baseline && (
            <div style={{ overflowX: "auto", marginBottom: "20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                    <th style={{ padding: "8px 12px" }}>Classifier (test set)</th>
                    <th style={{ padding: "8px 12px" }}>Macro-F1</th>
                    <th style={{ padding: "8px 12px" }}>Classifier false alerts / 10k</th>
                    {Object.keys(m.per_class).map((f) => <th key={f} style={{ padding: "8px 12px" }}>{f} F1</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([[`${report.classifier} (chosen)`, m], ["Random forest baseline", report.random_forest_baseline]] as [string, typeof m][]).map(([name, sm]) => (
                    <tr key={name} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{name}</td>
                      <td className="mono" style={{ padding: "10px 12px" }}>{sm.macro_f1.toFixed(3)}</td>
                      <td className="mono" style={{ padding: "10px 12px" }}>{sm.false_alerts_per_10k_benign_flows}</td>
                      {Object.keys(m.per_class).map((f) => (
                        <td key={f} className="mono" style={{ padding: "10px 12px" }}>{sm.per_class[f]?.["f1-score"]?.toFixed(3) ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.imbalance_study && (
            <>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--nw-text-primary)", margin: "4px 0" }}>
                Imbalance strategies{" "}
                <span style={{ fontWeight: 400, color: "var(--nw-text-muted)" }}>
                  ({report.imbalance_study.evaluated_on}; chosen: {report.imbalance_study.chosen})
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                    <th style={{ padding: "8px 12px" }}>Strategy</th>
                    <th style={{ padding: "8px 12px" }}>Macro-F1</th>
                    <th style={{ padding: "8px 12px" }}>Lowest per-class recall</th>
                  </tr>
                </thead>
                <tbody>
                  {report.imbalance_study.results.map((r) => {
                    const chosen = r.strategy === report.imbalance_study!.chosen;
                    const worst = r.recall ? Object.entries(r.recall).sort((a, b) => a[1] - b[1])[0] : undefined;
                    return (
                      <tr key={r.strategy} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: chosen ? 700 : 400 }}>
                          {r.strategy}{chosen ? " (chosen)" : ""}
                        </td>
                        <td className="mono" style={{ padding: "10px 12px" }}>{r.macro_f1.toFixed(3)}</td>
                        <td className="mono" style={{ padding: "10px 12px" }}>{worst ? `${worst[0]} ${pct(worst[1])}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── CONFUSION MATRIX ──────────────────────────────────── */}
      <ConfusionMatrix
        labels={m.confusion_matrix.labels}
        rows={m.confusion_matrix.rows}
        accuracyForReferenceOnly={m.accuracy_for_reference_only}
      />
    </div>
  );
}
