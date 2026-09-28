"use client";

import Link from "next/link";
import type { Alert, DriftStatus } from "@/lib/types";
import type { EvaluationReport } from "@/lib/mockData";

interface Props {
  alerts: Alert[];
  report: EvaluationReport | null;
  drift: DriftStatus | null;
}

const COLORS = ["var(--nw-card-1)", "var(--nw-card-2)", "var(--nw-card-3)"];

export default function LowerDetailCards({ alerts, report, drift }: Props) {
  // families among the alerts on screen, largest first
  const counts = new Map<string, number>();
  alerts.forEach((a) => counts.set(a.prediction.family, (counts.get(a.prediction.family) ?? 0) + 1));
  const families = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n], i) => ({
      name: name === "Unknown" ? "Unknown (never seen)" : name,
      count: n.toLocaleString(),
      pct: Math.round((100 * n) / Math.max(alerts.length, 1)),
      color: name === "Unknown" ? "var(--nw-card-3)" : COLORS[i % 2],
    }));
  const falsePositives = alerts.filter((a) => a.status === "false_positive").length;
  const topPsi = drift?.top_features?.[0]?.psi;
  const driftLabel = !drift
    ? "DRIFT: —"
    : drift.status === "warming_up"
    ? "WARMING UP"
    : `${drift.status.toUpperCase()}${topPsi !== undefined ? ` (PSI ${topPsi.toFixed(3)})` : ""}`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "20px",
      }}
    >
      {/* ── CARD 1: TOP ATTACK FAMILIES ────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "22px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
                Top Attack Families
              </div>
              <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                Among the {alerts.length.toLocaleString()} alerts loaded
              </div>
            </div>
            <span className="nw-pill nw-pill-amber">{counts.size} {counts.size === 1 ? "FAMILY" : "FAMILIES"}</span>
          </div>

          {/* Rows of data */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {families.length === 0 && (
              <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>No alerts yet.</div>
            )}
            {families.map((fam) => (
              <div key={fam.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: fam.color,
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                      {fam.name}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
                    <strong style={{ color: "var(--nw-text-primary)" }}>{fam.count}</strong> alerts
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "5px",
                    width: "100%",
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    borderRadius: "9999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${fam.pct}%`,
                      backgroundColor: fam.color,
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colored action button */}
        <div style={{ marginTop: "24px" }}>
          <Link
            href="/evaluation"
            className="nw-btn-pill nw-btn-purple"
            style={{ width: "100%" }}
          >
            View Evaluation &amp; LOFO Table →
          </Link>
        </div>
      </div>

      {/* ── CARD 2: ACTIVE MODEL & DRIFT HEALTH ────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "22px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
                Active Model &amp; Drift Health
              </div>
              <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                Production pipeline governance · v1-prod
              </div>
            </div>
            <span className="nw-pill nw-pill-lime">{driftLabel}</span>
          </div>

          {/* Rows of data */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Ensemble Architecture</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                LightGBM + Isolation Forest
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Operating Threshold</span>
              <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--nw-card-1)" }}>
                {report
                  ? `${report.threshold.threshold.toFixed(3)} (FPR ≤ ${Math.round(report.threshold.fpr_budget * 10000)}/10k)`
                  : "—"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Leakage-Free Validation</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-card-3)" }}>
                5-Min Temporal Block (tests/test_split_leakage.py)
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Never-Seen Shown as Unknown</span>
              <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--nw-card-2)" }}>
                {report
                  ? `${((report.novel_families.shown_as_unknown ?? report.novel_families.caught_by_anomaly_detector) * 100).toFixed(1)}% (held-out test)`
                  : "—"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Analyst Retraining Queue</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                {falsePositives} False Positive{falsePositives === 1 ? "" : "s"} Logged
              </span>
            </div>
          </div>
        </div>

        {/* Colored action button */}
        <div style={{ marginTop: "24px" }}>
          <Link
            href="/drift"
            className="nw-btn-pill nw-btn-lime"
            style={{ width: "100%" }}
          >
            Inspect Drift Monitor &amp; Retrain →
          </Link>
        </div>
      </div>
    </div>
  );
}
