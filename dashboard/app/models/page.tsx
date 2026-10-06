"use client";

import { useEffect, useState } from "react";
import { getModelRegistryInfo } from "@/lib/api";
import type { ChangelogItem, ModelRegistryInfo, ModelVersionEntry } from "@/lib/types";

// where each threshold comes from (api/routes/metrics.py, models/v1/thresholds.json)
const ORIGIN: Record<string, string> = {
  attack_threshold: "False-positive budget",
  anomaly_threshold: "1% of benign validation flows",
  fpr_budget: "ml/config.yaml",
  drift_psi_warning: "Standard PSI band",
  drift_psi_drift: "Standard PSI band",
};

function badgeForType(type: ChangelogItem["type"]): { label: string; className: string } {
  switch (type) {
    case "fixed":
      return { label: "FIXED", className: "nw-pill-lime" };
    case "added":
      return { label: "ADDED", className: "nw-pill-purple" };
    case "changed":
      return { label: "CHANGED", className: "nw-pill-amber" };
    case "verified":
      return { label: "VERIFIED", className: "nw-pill-lime" };
    case "tradeoff":
      return { label: "TRADE-OFF", className: "nw-pill-amber" };
  }
}

function statusPillForVersion(status: ModelVersionEntry["status"]): { label: string; className: string } {
  switch (status) {
    case "active":
      return { label: "ACTIVE RELEASE", className: "nw-pill-lime" };
    case "superseded":
      return { label: "SUPERSEDED", className: "nw-pill-purple" };
    case "baseline":
      return { label: "INITIAL BASELINE", className: "nw-pill-purple" };
    case "planned":
      return { label: "PLANNED CANDIDATE", className: "nw-pill-amber" };
  }
}

export default function ModelsPage() {
  const [info, setInfo] = useState<ModelRegistryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>("All");

  useEffect(() => {
    const load = () =>
      getModelRegistryInfo()
        .then((data) => {
          setInfo(data);
          setError(null);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Could not reach GET /models");
        });
    load();
    // the feedback counts change as analysts triage, often in another tab:
    // reload them when this one comes back into view
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  // served by GET /models; there is no copy in the dashboard to go stale
  const versionHistory = info?.version_history ?? [];
  const activeRelease = versionHistory.find((v) => v.status === "active");
  const released = versionHistory.filter((v) => v.status !== "planned");
  const liveFigure = (label: string, fallback: string) =>
    activeRelease?.highlights.find((h) => h.label === label)?.after ?? fallback;
  const visibleVersions =
    selectedVersion === "All"
      ? versionHistory
      : versionHistory.filter((v) => v.version === selectedVersion);

  const thresholdEntries = Object.entries(info?.thresholds ?? {});
  const feedbackEntries = Object.entries(info?.feedback ?? {});

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "26px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: "var(--nw-text-primary)" }}>
          Model Registry, Version History &amp; Training Governance
        </h1>
        <p style={{ margin: 0, color: "var(--nw-text-muted)", fontSize: "13px", maxWidth: "860px" }}>
          The trained model bundle, the code releases that produced it (`v1.0` &rarr; `v1.1` &rarr; `v1.2`), and the analyst supervision loop.
          A candidate model is promoted only after beating the incumbent on the identical 5-minute time-block test split.
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
          <span
            className={`nw-pill ${info ? "nw-pill-purple" : "nw-pill-amber"}`}
            style={{ fontSize: "10px", display: "inline-block" }}
          >
            {info ? "LIVE · GET /models" : `API OFFLINE · ${error ?? "Connect backend on :8000"}`}
          </span>
          <span className="nw-pill nw-pill-lime" style={{ fontSize: "10px", display: "inline-block" }}>
            MODEL BUNDLES: {info?.versions?.join(" · ") ?? "—"} · CODE RELEASES: {released.map((v) => v.version).join(" · ") || "—"}
          </span>
        </div>
      </div>

      {/* ── STATS HIGHLIGHTS ─────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginBottom: "26px",
        }}
      >
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-2)", textTransform: "uppercase" }}>
            Active Model Bundle
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {info ? info.active : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            {info ? `Deployed in scoring pipeline${activeRelease ? ` · code release ${activeRelease.version}` : ""}` : "Start backend API for live status"}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase" }}>
            Classifier Engine
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--nw-text-primary)", margin: "10px 0 4px" }}>
            {info ? info.classifier : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-card-3)" }}>
            {info ? "TreeSHAP explainer attached" : "Awaiting GET /models"}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-3)", textTransform: "uppercase" }}>
            Code Releases
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-card-3)", margin: "4px 0" }}>
            {info ? released.length : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            of one trained bundle · v2.0 planned, not trained
          </div>
        </div>

        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "20px", padding: "20px 24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-1)", textTransform: "uppercase" }}>
            Analyst False Positives
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-card-1)", margin: "4px 0" }}>
            {info ? info.feedback?.false_positive ?? 0 : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            Kept as labels for the next training run
          </div>
        </div>
      </div>

      {/* ── VERSION PROGRESSION COMPARISON TABLE ─────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "24px",
          padding: "24px",
          marginBottom: "26px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
              Release Progression (v1.0 &rarr; v1.1 &rarr; v1.2 &rarr; v2.0 planned)
            </div>
            <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px", maxWidth: "760px" }}>
              {info?.version_history_note ??
                "Code releases of the one trained bundle. Older figures as recorded in each release commit."}
            </div>
          </div>

          {/* Version Filter Pills */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["All", ...versionHistory.map((v) => v.version)].map((ver) => (
              <button
                key={ver}
                onClick={() => setSelectedVersion(ver)}
                style={{
                  border: "none",
                  outline: "none",
                  padding: "6px 14px",
                  borderRadius: "9999px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor:
                    selectedVersion === ver ? "var(--nw-accent-purple)" : "rgba(255, 255, 255, 0.05)",
                  color: selectedVersion === ver ? "#FFFFFF" : "var(--nw-text-muted)",
                  transition: "all 0.15s ease",
                }}
              >
                {ver === "All" ? "All Versions" : ver}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                <th style={{ padding: "10px 14px" }}>Version</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px" }}>Anomaly Feature Scaling</th>
                <th style={{ padding: "10px 14px" }}>Out-of-Family Gate</th>
                <th style={{ padding: "10px 14px" }}>PortScan LOFO Recall</th>
                <th style={{ padding: "10px 14px" }}>Unseen &rarr; Unknown</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>SHAP Engine</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)", backgroundColor: "rgba(199, 219, 110, 0.04)" }}>
                <td className="mono" style={{ padding: "12px 14px", fontWeight: 800, color: "var(--nw-card-3)" }}>v1.2</td>
                <td style={{ padding: "12px 14px" }}><span className="nw-pill nw-pill-lime" style={{ fontSize: "10px" }}>ACTIVE</span></td>
                <td className="mono" style={{ padding: "12px 14px", color: "#FFFFFF" }}>sign(X) * log1p(|X|) + StandardScaler</td>
                <td style={{ padding: "12px 14px" }}>Independent IQR z-score (keep 99%)</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-3)", fontWeight: 700 }}>{liveFigure("Held-Out PortScan LOFO", "—")}</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-2)", fontWeight: 700 }}>{liveFigure("Unseen Shown as Unknown", "—")}</td>
                <td className="mono" style={{ padding: "12px 14px", textAlign: "right" }}>Batch TreeSHAP (3D)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <td className="mono" style={{ padding: "12px 14px", fontWeight: 800, color: "var(--nw-card-2)" }}>v1.1</td>
                <td style={{ padding: "12px 14px" }}><span className="nw-pill nw-pill-purple" style={{ fontSize: "10px" }}>SUPERSEDED</span></td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>Raw StandardScaler</td>
                <td style={{ padding: "12px 14px" }}>Independent IQR z-score (keep 99%)</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-1)" }}>0.0%</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-2)", fontWeight: 700 }}>90.7%</td>
                <td className="mono" style={{ padding: "12px 14px", textAlign: "right", color: "var(--nw-text-muted)" }}>Per-row TreeSHAP</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <td className="mono" style={{ padding: "12px 14px", fontWeight: 800, color: "var(--nw-text-primary)" }}>v1.0</td>
                <td style={{ padding: "12px 14px" }}><span className="nw-pill nw-pill-purple" style={{ fontSize: "10px" }}>BASELINE</span></td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>Raw StandardScaler</td>
                <td style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>Gated on detector corroboration</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-card-1)" }}>0.0%</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>0.0% (Heartbleed)</td>
                <td className="mono" style={{ padding: "12px 14px", textAlign: "right", color: "var(--nw-text-muted)" }}>Z-score fallback</td>
              </tr>
              <tr>
                <td className="mono" style={{ padding: "12px 14px", fontWeight: 800, color: "var(--nw-card-1)" }}>v2.0</td>
                <td style={{ padding: "12px 14px" }}><span className="nw-pill nw-pill-amber" style={{ fontSize: "10px" }}>PLANNED</span></td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>sign(X) * log1p(|X|) + StandardScaler</td>
                <td style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>Re-calibrated with analyst FP labels</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>Gated (&ge; v1.2)</td>
                <td className="mono" style={{ padding: "12px 14px", color: "var(--nw-text-muted)" }}>Gated (&ge; v1.2)</td>
                <td className="mono" style={{ padding: "12px 14px", textAlign: "right", color: "var(--nw-text-muted)" }}>Batch TreeSHAP (3D)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VERSION RELEASE CARDS & CHANGELOGS ───────────────── */}
      <div style={{ marginBottom: "26px" }}>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--nw-text-primary)", marginBottom: "14px" }}>
          Release Changelogs &amp; Architectural Diffs
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {visibleVersions.map((ver) => {
            const statusPill = statusPillForVersion(ver.status);
            const isActive = ver.status === "active";

            return (
              <div
                key={ver.version}
                style={{
                  backgroundColor: "var(--nw-bg-panel)",
                  borderRadius: "24px",
                  padding: "26px",
                  border: isActive
                    ? "1px solid rgba(199, 219, 110, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                {/* Version Header Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        color: isActive ? "var(--nw-card-3)" : "var(--nw-card-2)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        padding: "4px 14px",
                        borderRadius: "12px",
                      }}
                    >
                      {ver.version}
                    </span>
                    <div>
                      <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "var(--nw-text-primary)" }}>
                        {ver.title}
                      </h2>
                      <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
                        Release Date: {ver.date}
                        {ver.commit ? ` · Commit ${ver.commit}` : ""}
                      </div>
                    </div>
                  </div>

                  <span className={`nw-pill ${statusPill.className}`} style={{ fontSize: "10px" }}>
                    {statusPill.label}
                  </span>
                </div>

                {/* Version Summary */}
                <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.6 }}>
                  {ver.summary}
                </p>

                {/* Highlights / Metric Deltas Strip */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                    marginBottom: "20px",
                  }}
                >
                  {ver.highlights.map((h) => (
                    <div
                      key={h.label}
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.25)",
                        borderRadius: "14px",
                        padding: "12px 16px",
                        border: "1px solid rgba(255, 255, 255, 0.04)",
                      }}
                    >
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                        {h.label}
                      </div>
                      <div className="mono" style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>
                        {h.before ? (
                          <>
                            <span style={{ color: "var(--nw-text-muted)", textDecoration: "line-through", marginRight: "6px", fontWeight: 500 }}>
                              {h.before}
                            </span>
                            <span style={{ color: "var(--nw-card-2)", marginRight: "6px" }}>&rarr;</span>
                            <span style={{ color: "var(--nw-card-3)" }}>{h.after}</span>
                          </>
                        ) : (
                          <span style={{ color: "var(--nw-card-2)" }}>{h.after}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detailed Changelog Items */}
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.04em" }}>
                  Changelog ({ver.changelog.length} entries)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {ver.changelog.map((item, idx) => {
                    const badge = badgeForType(item.type);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "95px 190px 1fr",
                          gap: "12px",
                          alignItems: "baseline",
                          backgroundColor: "rgba(255, 255, 255, 0.025)",
                          padding: "12px 16px",
                          borderRadius: "14px",
                        }}
                        className="changelog-row"
                      >
                        <div>
                          <span className={`nw-pill ${badge.className}`} style={{ fontSize: "9px", padding: "2px 8px" }}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: "12px", color: "var(--nw-card-2)", fontWeight: 600 }}>
                          {item.module}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--nw-text-primary)", lineHeight: 1.5 }}>
                          {item.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── THRESHOLDS & FEEDBACK GRID ────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "22px",
          marginBottom: "26px",
        }}
      >
        {/* Thresholds Panel */}
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "24px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "16px" }}>
            Active Operating Thresholds
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                <th style={{ padding: "8px 0" }}>Parameter</th>
                <th style={{ padding: "8px 0" }}>Value</th>
                <th style={{ padding: "8px 0", textAlign: "right" }}>Origin</th>
              </tr>
            </thead>
            <tbody>
              {thresholdEntries.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "16px 0", color: "var(--nw-text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    No live thresholds loaded — start `make api` after running `make train`.
                  </td>
                </tr>
              ) : (
                thresholdEntries.map(([param, val]) => (
                  <tr key={param} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "10px 0", textTransform: "capitalize" }}>{param.replace(/_/g, " ")}</td>
                    <td className="mono" style={{ padding: "10px 0", color: "var(--nw-card-2)", fontWeight: 700 }}>
                      {val}
                    </td>
                    <td style={{ padding: "10px 0", textAlign: "right", color: "var(--nw-text-muted)" }}>
                      {ORIGIN[param] ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Feedback Queue */}
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "24px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "16px" }}>
            Analyst Triage Supervision Queue
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #26262C", textAlign: "left", color: "var(--nw-text-muted)" }}>
                <th style={{ padding: "8px 0" }}>Disposition</th>
                <th style={{ padding: "8px 0" }}>Count</th>
                <th style={{ padding: "8px 0", textAlign: "right" }}>Role in Retraining</th>
              </tr>
            </thead>
            <tbody>
              {feedbackEntries.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "16px 0", color: "var(--nw-text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    No live triage counts loaded — start `make api` to query SQLite alert dispositions.
                  </td>
                </tr>
              ) : (
                feedbackEntries.map(([statusKey, count]) => {
                  const isFp = statusKey === "false_positive";
                  return (
                    <tr key={statusKey} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <td style={{ padding: "10px 0", textTransform: "capitalize" }}>{statusKey.replace(/_/g, " ")}</td>
                      <td className="mono" style={{ padding: "10px 0", fontWeight: 700, color: isFp ? "var(--nw-card-1)" : "#FFFFFF" }}>
                        {count}
                      </td>
                      <td style={{ padding: "10px 0", textAlign: "right", color: "var(--nw-text-muted)" }}>
                        {isFp ? "Relabel as Benign" : "Confirmation Signal"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODEL CARD ───────────────────────────────────────── */}
      {info?.model_card && (
        <details
          style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "20px 24px", marginBottom: "26px" }}
        >
          <summary style={{ cursor: "pointer", fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
            Model card <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--nw-text-muted)" }}>(docs/model_card.md, generated by make evaluate)</span>
          </summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "12.5px",
              lineHeight: 1.55,
              color: "var(--nw-text-muted)",
              marginTop: "14px",
              maxHeight: "560px",
              overflowY: "auto",
            }}
          >
            {info.model_card}
          </pre>
        </details>
      )}

      {/* ── GOVERNANCE PROMOTION CALLOUT ──────────────────────── */}
      <div
        style={{
          backgroundColor: "rgba(167, 139, 250, 0.08)",
          borderRadius: "24px",
          padding: "26px",
          border: "1px solid rgba(167, 139, 250, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "18px",
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-card-2)", marginBottom: "4px" }}>
            Governance Protocol // Model Candidate v2.0 Promotion (planned)
          </div>
          <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", maxWidth: "800px" }}>
            Analyst dispositions are stored with each alert in SQLite. The plan: train a candidate v2.0 on
            that feedback and promote it ONLY if it achieves a higher macro-F1 than v1.2 on the identical
            5-minute time-block test split without exceeding the FPR budget. Today retraining is{" "}
            <code>make train</code>, run by hand.
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 760px) {
          .changelog-row {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }
        }
      `}</style>
    </div>
  );
}
