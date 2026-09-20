"use client";

import { useEffect, useState } from "react";

import { getModelMetrics } from "@/lib/api";

interface ClassMetrics { precision: number; recall: number; "f1-score": number; support: number }
interface Summary {
  per_class: Record<string, ClassMetrics>;
  macro_f1: number;
  false_positive_rate: number;
  false_alerts_per_10k_benign_flows: number;
  auc: Record<string, { pr_auc: number; roc_auc: number }>;
  confusion_matrix: { labels: string[]; rows: number[][] };
  accuracy_for_reference_only: number;
}
interface Report {
  classifier: string;
  threshold: { threshold: number; fpr_at_threshold?: number; recall_at_threshold?: number };
  main: Summary;
  lofo?: { family: string; caught_by_classifier_alone: number; caught_by_full_system: number; benign_fpr: number }[];
  novel_families?: { families: string[]; flows: number; caught_by_anomaly_detector: number };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function Evaluation() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModelMetrics()
      .then((r) => setReport(r as unknown as Report))
      .catch(() => setError("No metrics yet. Run `make train` first."));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p className="empty">Loading…</p>;
  const m = report.main;

  return (
    <>
      <h1>Evaluation</h1>
      <p className="lede">
        Split by 5-minute time blocks, so no attack burst appears in both training and test.
        Threshold chosen from a false-positive budget, not left at 0.5.
      </p>

      <div className="row" style={{ marginBottom: 18 }}>
        <div className="panel stat"><b>{m.macro_f1}</b><span>macro-F1</span></div>
        <div className="panel stat">
          <b>{m.false_alerts_per_10k_benign_flows}</b><span>false alerts per 10k benign flows</span>
        </div>
        <div className="panel stat">
          <b>{report.threshold.threshold.toFixed(3)}</b><span>alert threshold</span>
        </div>
        <div className="panel stat">
          <b>{report.novel_families ? pct(report.novel_families.caught_by_anomaly_detector) : "—"}</b>
          <span>never-trained families caught</span>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Per class</h2>
        <table>
          <thead>
            <tr><th>Family</th><th>Precision</th><th>Recall</th><th>F1</th><th>PR-AUC</th><th>Flows</th></tr>
          </thead>
          <tbody>
            {Object.entries(m.per_class).map(([family, c]) => (
              <tr key={family}>
                <td>{family}</td>
                <td>{c.precision.toFixed(3)}</td>
                <td>{c.recall.toFixed(3)}</td>
                <td>{c["f1-score"].toFixed(3)}</td>
                <td>{report.main.auc[family]?.pr_auc?.toFixed(3) ?? "—"}</td>
                <td>{c.support.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.lofo && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Leave one attack family out</h2>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Each row: the family was removed from training entirely, then tested.
          </p>
          <table>
            <thead>
              <tr><th>Family</th><th>Classifier alone</th><th>With anomaly detection</th><th>Benign FPR</th></tr>
            </thead>
            <tbody>
              {report.lofo.map((r) => (
                <tr key={r.family}>
                  <td>{r.family}</td>
                  <td>{pct(r.caught_by_classifier_alone)}</td>
                  <td><strong>{pct(r.caught_by_full_system)}</strong></td>
                  <td>{pct(r.benign_fpr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Confusion matrix</h2>
        <table>
          <thead>
            <tr>
              <th>actual \ predicted</th>
              {m.confusion_matrix.labels.map((l) => <th key={l}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {m.confusion_matrix.rows.map((row, i) => {
              const total = row.reduce((a, b) => a + b, 0) || 1;
              return (
                <tr key={m.confusion_matrix.labels[i]}>
                  <th>{m.confusion_matrix.labels[i]}</th>
                  {row.map((v, j) => (
                    <td key={j} style={{ background: `rgba(47,93,138,${(v / total) * 0.55})` }}>
                      {v.toLocaleString()}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Accuracy is {m.accuracy_for_reference_only} and is not a useful summary here: benign traffic
          dominates, so a model that never alerts would score close to it.
        </p>
      </div>
    </>
  );
}
