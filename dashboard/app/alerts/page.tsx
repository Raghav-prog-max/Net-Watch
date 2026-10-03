"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SeverityBadge from "@/components/SeverityBadge";
import ShapBar from "@/components/ShapBar";
import { ApiUnreachable, listAlerts, triage } from "@/lib/api";
import { subscribeToAlerts } from "@/lib/socket";
import type { Alert, Level } from "@/lib/types";

const LEVELS: (Level | "All")[] = ["All", "Critical", "High", "Medium", "Low"];

export default function AlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level, setLevel] = useState<Level | "All">("All");
  const [novelOnly, setNovelOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [triagePendingId, setTriagePendingId] = useState<string | null>(null);
  const [triageSuccessMsg, setTriageSuccessMsg] = useState<string | null>(null);
  const [triageErrorMsg, setTriageErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initial load & real-time WebSocket subscription
  useEffect(() => {
    listAlerts({ limit: "250" }).then((loadedAlerts) => {
      setLoadError(null);
      setAlerts(loadedAlerts);
      if (loadedAlerts.length > 0 && !expandedId) {
        setExpandedId(loadedAlerts[0].id);
      }
    }).catch((e) => {
      setAlerts([]);
      setLoadError(
        e instanceof ApiUnreachable
          ? "The API is not reachable on :8000. Start it with `make api`."
          : `Could not load alerts: ${e instanceof Error ? e.message : "unknown error"}`
      );
    });

    const unsubscribe = subscribeToAlerts((incomingAlert) => {
      setAlerts((prev) => {
        if (isPaused) return prev;
        const filtered = prev.filter((a) => a.id !== incomingAlert.id);
        return [incomingAlert, ...filtered].slice(0, 300);
      });
    });

    return () => unsubscribe();
  }, [isPaused, expandedId]);

  // One-click triage handler
  async function handleTriage(
    alertId: string,
    status: Alert["status"],
    note?: string
  ) {
    setTriagePendingId(alertId);
    setTriageErrorMsg(null);
    try {
      const updated = await triage(
        alertId,
        status,
        status === "false_positive" ? "Analyst FP" : undefined,
        note
      );
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      setTriageSuccessMsg(`Alert ${alertId} updated to ${status.replace("_", " ")}`);
      setTimeout(() => setTriageSuccessMsg(null), 3000);
    } catch (e) {
      // The API answered and refused. Keep the alert as it was: showing the new
      // status would tell the analyst a label was saved when it was not.
      setTriageErrorMsg(
        `Could not update ${alertId}: ${e instanceof Error ? e.message : "unknown error"}. Nothing was saved.`
      );
    } finally {
      setTriagePendingId(null);
    }
  }

  // Filtered alert list, most severe first (handbook: "sorted by severity")
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (level !== "All" && a.severity.level !== level) return false;
      if (novelOnly && !a.is_novel) return false;
      if (statusFilter !== "All" && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const src = a.flow.src_ip?.toLowerCase() ?? "";
        const dst = a.flow.dst_ip?.toLowerCase() ?? "";
        const fam = a.prediction.family.toLowerCase();
        const tech = a.mitre.technique.toLowerCase();
        const feat = a.explanation[0]?.feature.toLowerCase() ?? "";
        if (!src.includes(q) && !dst.includes(q) && !fam.includes(q) && !tech.includes(q) && !feat.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((x, y) =>
      y.severity.score - x.severity.score || y.timestamp.localeCompare(x.timestamp));
  }, [alerts, level, novelOnly, statusFilter, searchQuery]);

  // counts by family across everything loaded, largest first
  const familyCounts = useMemo(() => {
    const c = new Map<string, number>();
    alerts.forEach((a) => c.set(a.prediction.family, (c.get(a.prediction.family) ?? 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px", color: "var(--nw-text-primary)" }}>
            Live Security Alerts Feed
          </h1>
          <p style={{ margin: 0, color: "var(--nw-text-muted)", fontSize: "13px" }}>
            Sorted by severity. Nothing is blocked automatically — every alert empowers human analyst decisions.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`nw-btn-pill ${isPaused ? "nw-btn-amber" : "nw-btn-dark"}`}
          >
            {isPaused ? "▶ Resume Stream" : "⏸ Pause Stream"}
          </button>
        </div>
      </div>

      {triageSuccessMsg && (
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: "rgba(167, 139, 250, 0.15)",
            borderRadius: "14px",
            color: "var(--nw-card-2)",
            fontSize: "13px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>✓</span> {triageSuccessMsg}
        </div>
      )}

      {triageErrorMsg && (
        <div role="alert" style={{
            padding: "10px 18px",
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.35)",
            borderRadius: "14px",
            color: "var(--nw-card-1)",
            fontSize: "13px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
          <span>▲</span> {triageErrorMsg}
        </div>
      )}

      {/* ── FILTERS BAR ────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "18px",
          padding: "14px 20px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevel(lvl)}
              style={{
                border: "none",
                outline: "none",
                padding: "6px 14px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: level === lvl ? "var(--nw-card-circle)" : "transparent",
                color: level === lvl ? "#FFFFFF" : "var(--nw-text-muted)",
                transition: "all 0.15s ease",
              }}
            >
              {lvl}
            </button>
          ))}
          <button
            onClick={() => setNovelOnly(!novelOnly)}
            style={{
              border: "none",
              outline: "none",
              padding: "6px 14px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: novelOnly ? "rgba(255, 255, 255, 0.15)" : "transparent",
              color: novelOnly ? "var(--nw-card-1)" : "var(--nw-text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            Novel Zero-Day Only
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: "1 1 280px", maxWidth: "420px" }}>
          <input
            type="text"
            placeholder="Search IP, family, technique..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 16px",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "9999px",
              color: "#FFFFFF",
              fontSize: "12px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {familyCounts.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px", fontSize: "12px" }}>
          <span style={{ color: "var(--nw-text-muted)", alignSelf: "center" }}>By family:</span>
          {familyCounts.map(([fam, n]) => (
            <span key={fam} className={`nw-pill ${fam === "Unknown" ? "nw-pill-amber" : "nw-pill-purple"}`}>
              {fam} {n}
            </span>
          ))}
        </div>
      )}

      {/* ── ALERTS LIST ────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredAlerts.length === 0 && (
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "20px",
              padding: "32px 24px",
              textAlign: "center",
              color: "var(--nw-text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
            }}
          >
            {loadError
              ? loadError
              : alerts.length === 0
              ? "No alerts recorded yet. Start the backend API (`make api`) and stream traffic (`make demo`) to receive live alerts."
              : "No alerts match the active filters."}
          </div>
        )}
        {filteredAlerts.map((alert) => {
          const isExpanded = expandedId === alert.id;
          const isCritical = alert.severity.level === "Critical";
          const isHigh = alert.severity.level === "High";

          const pillClass = isCritical
            ? "nw-pill-amber"
            : isHigh
            ? "nw-pill-purple"
            : "nw-pill-lime";

          const srcIp = alert.flow.src_ip ?? "—";
          const dstIp = alert.flow.dst_ip ?? "—";
          const dstPort = alert.flow.dst_port ?? "—";

          return (
            <div
              key={alert.id}
              style={{
                backgroundColor: "var(--nw-bg-panel)",
                borderRadius: "20px",
                overflow: "hidden",
                transition: "background-color 0.15s ease",
              }}
            >
              {/* Row Bar */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                style={{
                  padding: "18px 24px",
                  display: "grid",
                  gridTemplateColumns: "100px 140px 1fr 140px 100px 110px 40px",
                  alignItems: "center",
                  cursor: "pointer",
                  gap: "12px",
                }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--nw-text-muted)" }}>
                  {alert.timestamp.slice(11, 19)} UTC
                </div>

                <div>
                  <SeverityBadge level={alert.severity.level} score={alert.severity.score} compact />
                </div>

                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--nw-text-primary)" }}>
                  <span>{srcIp}</span>
                  <span style={{ color: "var(--nw-card-2)", margin: "0 6px" }}>→</span>
                  <span>{dstIp}:{dstPort}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>
                    {alert.prediction.family}
                  </span>
                  {alert.is_novel && (
                    <span className="nw-pill nw-pill-amber" style={{ fontSize: "9px", padding: "1px 6px" }}>
                      NOVEL
                    </span>
                  )}
                  {alert.flow_count > 1 && (
                    <span
                      className="mono"
                      title={`${alert.flow_count.toLocaleString()} flows grouped into this alert`}
                      style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}
                    >
                      ×{alert.flow_count.toLocaleString()}
                    </span>
                  )}
                </div>

                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--nw-text-muted)" }}>
                  {(alert.prediction.confidence * 100).toFixed(1)}%
                </div>

                <div>
                  <span className={`nw-pill ${pillClass}`} style={{ fontSize: "10px" }}>
                    {alert.status.replace("_", " ")}
                  </span>
                </div>

                <div style={{ textAlign: "right", color: "var(--nw-text-muted)", fontSize: "11px" }}>
                  {isExpanded ? "▲" : "▼"}
                </div>
              </div>

              {/* Expanded Accordion Drawer */}
              {isExpanded && (
                <div
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                    padding: "22px 26px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "24px",
                  }}
                >
                  {/* Left: SHAP attribution */}
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase", marginBottom: "12px" }}>
                      SHAP Feature Attribution (Why Model Fired)
                    </div>
                    <ShapBar items={alert.explanation} />
                  </div>

                  {/* Right: MITRE & Actions */}
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase", marginBottom: "12px" }}>
                      MITRE ATT&amp;CK Context &amp; Triage
                    </div>

                    <div
                      style={{
                        backgroundColor: "rgba(167, 139, 250, 0.08)",
                        borderRadius: "16px",
                        padding: "14px 18px",
                        marginBottom: "16px",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-2)", textTransform: "uppercase" }}>
                        TACTIC: {alert.mitre.tactic}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", margin: "4px 0" }}>
                        {alert.mitre.technique}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
                        {alert.recommended_action}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                      <button
                        onClick={() => handleTriage(alert.id, "false_positive")}
                        disabled={triagePendingId === alert.id || alert.status === "false_positive"}
                        className="nw-btn-pill nw-btn-amber"
                      >
                        Mark False Positive
                      </button>
                      <button
                        onClick={() => handleTriage(alert.id, "acknowledged")}
                        disabled={triagePendingId === alert.id || alert.status === "acknowledged"}
                        className="nw-btn-pill nw-btn-dark"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => handleTriage(alert.id, "escalated")}
                        disabled={triagePendingId === alert.id || alert.status === "escalated"}
                        className="nw-btn-pill nw-btn-soft-purple"
                      >
                        Escalate
                      </button>
                      <button
                        onClick={() => handleTriage(alert.id, "resolved")}
                        disabled={triagePendingId === alert.id || alert.status === "resolved"}
                        className="nw-btn-pill nw-btn-lime"
                      >
                        Resolve
                      </button>
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="nw-btn-pill nw-btn-dark"
                        style={{ marginLeft: "auto" }}
                      >
                        Forensic View →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
