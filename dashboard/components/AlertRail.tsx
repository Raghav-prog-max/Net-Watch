"use client";

import { useState } from "react";
import type { Alert } from "@/lib/types";

interface AlertRailProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
  onTriage: (id: string, status: Alert["status"]) => void;
  onInjectTestFlow?: () => void;
}

export default function AlertRail({
  alerts,
  onSelectAlert,
  onTriage,
  onInjectTestFlow,
}: AlertRailProps) {
  const [filter, setFilter] = useState<"All" | "Critical" | "Novel">("All");

  const filtered = alerts.filter((a) => {
    if (filter === "Critical") return a.severity.level === "Critical";
    if (filter === "Novel") return a.is_novel;
    return true;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* ── HEADER OF RIGHT RAIL ──────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
            Live Alert Feed
          </div>
          <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
            {alerts.length} flagged events in queue
          </div>
        </div>

        {onInjectTestFlow && (
          <button
            onClick={onInjectTestFlow}
            className="nw-btn-pill nw-btn-dark"
            style={{ fontSize: "11px", padding: "5px 12px" }}
            title="Inject a realistic test flow into the feed"
          >
            + Inject Flow
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: "6px" }}>
        {(["All", "Critical", "Novel"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              border: "none",
              outline: "none",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: filter === tab ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
              color: filter === tab ? "#FFFFFF" : "var(--nw-text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            {tab === "All" ? "All Alerts" : tab === "Critical" ? "Critical Only" : "Zero-Day Novel"}
          </button>
        ))}
      </div>

      {/* ── SCROLLABLE STACK OF ITEM CARDS ────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxHeight: "calc(100vh - 180px)",
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "30px 16px",
              textAlign: "center",
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "18px",
              color: "var(--nw-text-muted)",
              fontSize: "12px",
            }}
          >
            No alerts matching current filter.
          </div>
        ) : (
          filtered.map((alert) => {
            const isCritical = alert.severity.level === "Critical";
            const isHigh = alert.severity.level === "High";
            const isNovel = alert.is_novel;

            // Pill style for severity
            const pillClass = isCritical
              ? "nw-pill-amber"
              : isHigh
              ? "nw-pill-purple"
              : "nw-pill-lime";

            // Action button style matching severity
            const actionBtnClass = isCritical
              ? "nw-btn-amber"
              : isHigh
              ? "nw-btn-soft-purple"
              : "nw-btn-lime";

            const srcIp = alert.flow.src_ip ?? "192.168.10.50";
            const dstIp = alert.flow.dst_ip ?? "172.16.0.1";
            const dstPort = alert.flow.dst_port ?? "80";

            return (
              <div
                key={alert.id}
                style={{
                  backgroundColor: "var(--nw-bg-panel)",
                  borderRadius: "18px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  transition: "transform 0.15s ease, background-color 0.15s ease",
                }}
              >
                {/* Top line: Title & Tag pill */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
                      {alert.prediction.family} {isNovel ? "Anomaly" : "Threat"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                      Score {alert.severity.score}/100 · {(alert.prediction.confidence * 100).toFixed(0)}% conf
                    </div>
                  </div>

                  <span className={`nw-pill ${pillClass}`}>
                    {alert.severity.level.toUpperCase()}
                  </span>
                </div>

                {/* Meta row: source / destination in mono */}
                <div
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    borderRadius: "10px",
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "var(--nw-text-primary)" }}>{srcIp}</span>
                  <span style={{ color: "var(--nw-card-2)", fontSize: "10px" }}>→</span>
                  <span style={{ color: "var(--nw-text-primary)" }}>{dstIp}:{dstPort}</span>
                </div>

                {/* Timestamp & Status */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "var(--nw-text-muted)",
                  }}
                >
                  <span>{alert.timestamp.slice(11, 19)} UTC</span>
                  <span style={{ textTransform: "capitalize" }}>
                    {alert.status.replace("_", " ")}
                  </span>
                </div>

                {/* Actions row: Colored action button whose color matches severity */}
                <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                  <button
                    onClick={() => onSelectAlert(alert)}
                    className={`nw-btn-pill ${actionBtnClass}`}
                    style={{ flex: 1, padding: "7px 14px", fontSize: "11px" }}
                  >
                    Investigate →
                  </button>
                  <button
                    onClick={() => onTriage(alert.id, "false_positive")}
                    className="nw-btn-pill nw-btn-dark"
                    style={{ padding: "7px 12px", fontSize: "11px" }}
                    title="Mark False Positive"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
