"use client";

import { useState } from "react";
import type { Alert } from "@/lib/types";

interface AlertRailProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
  onTriage: (id: string, status: Alert["status"]) => void;
}

export default function AlertRail({
  alerts,
  onSelectAlert,
  onTriage,
}: AlertRailProps) {
  const [filter, setFilter] = useState<"All" | "Critical" | "Novel">("All");

  const filtered = alerts.filter((a) => {
    if (filter === "Critical") return a.severity.level === "Critical";
    if (filter === "Novel") return a.is_novel;
    return true;
  });

  const critCount = alerts.filter((a) => a.severity.level === "Critical").length;
  const novelCount = alerts.filter((a) => a.is_novel).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── HEADER ──────────────────────────── */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ position: "relative", display: "flex", width: "8px", height: "8px" }}>
            <span style={{
              position: "absolute",
              display: "inline-flex",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
              opacity: 0.6,
              animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
            }} />
            <span style={{
              position: "relative",
              display: "inline-flex",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
            }} />
          </span>
          <h2 style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono)",
            margin: 0,
          }}>
            Live Alert Feed
          </h2>
        </div>
        <span style={{
          padding: "2px 8px",
          borderRadius: "9999px",
          fontSize: "10px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          color: "#FFFFFF",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        }}>
          {alerts.length} Queue
        </span>
      </div>

      {/* ── FILTER TABS ──────────────────────── */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        gap: "6px",
      }}>
        {([
          { key: "All" as const, label: `All (${alerts.length})` },
          { key: "Critical" as const, label: `Critical (${critCount})` },
          { key: "Novel" as const, label: `Zero-Day (${novelCount})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              border: "none",
              outline: "none",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: filter === tab.key ? 600 : 400,
              cursor: "pointer",
              backgroundColor: filter === tab.key ? "#FFFFFF" : "#141418",
              color: filter === tab.key ? "#000000" : "#8E909B",
              borderColor: filter === tab.key ? "transparent" : "rgba(255, 255, 255, 0.1)",
              borderWidth: "1px",
              borderStyle: "solid",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SCROLLABLE ALERT CARDS ──────────── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }} className="custom-scroll">
        {filtered.length === 0 ? (
          <div style={{
            padding: "30px 16px",
            textAlign: "center",
            backgroundColor: "#141418",
            borderRadius: "12px",
            color: "#8E909B",
            fontSize: "12px",
          }}>
            No alerts matching current filter.
          </div>
        ) : (
          filtered.map((alert) => {
            const isCritical = alert.severity.level === "Critical";
            const isNovel = alert.is_novel;
            const srcIp = alert.flow.src_ip ?? "—";
            const dstIp = alert.flow.dst_ip ?? "—";
            const dstPort = alert.flow.dst_port ?? "—";
            const protocol = alert.flow.protocol ?? "—";

            return (
              <div
                key={alert.id}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#141418",
                  border: isCritical
                    ? "1px solid rgba(255, 255, 255, 0.2)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Top: Severity Pill & Confidence */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    backgroundColor: isCritical ? "#FFFFFF" : isNovel ? "rgba(255, 255, 255, 0.1)" : "#1A1A20",
                    color: isCritical ? "#000000" : "#FFFFFF",
                    border: isCritical ? "none" : "1px solid rgba(255, 255, 255, 0.2)",
                  }}>
                    {isNovel ? "NOVEL" : alert.severity.level.toUpperCase()}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)", fontSize: "12px", color: isCritical ? "#FFFFFF" : "#E1E4EA", fontWeight: 600 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      {isCritical ? "bolt" : isNovel ? "fingerprint" : "analytics"}
                    </span>
                    {(alert.prediction.confidence * 100).toFixed(1)}%
                  </div>
                </div>

                {/* Title & Time */}
                <div>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em", margin: 0 }}>
                    {alert.prediction.family} {isNovel ? "Anomaly" : "Exploit"}
                  </h3>
                  <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
                    Score {alert.severity.score}/100 · {alert.timestamp.slice(11, 19)} UTC
                  </span>
                </div>

                {/* Network Route */}
                <div style={{
                  padding: "8px",
                  borderRadius: "6px",
                  backgroundColor: "#050508",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "#E1E4EA",
                  userSelect: "all" as const,
                }}>
                  SRC: {srcIp} → DST: {dstIp}:{dstPort} ({protocol})
                </div>

                {/* Status & Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
                  <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
                    STATUS: <strong style={{ color: "#FFFFFF" }}>{alert.status.replace("_", " ").toUpperCase()}</strong>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      onClick={() => onTriage(alert.id, "false_positive")}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "9999px",
                        backgroundColor: "#1A1A20",
                        color: "#8E909B",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        fontSize: "11px",
                        cursor: "pointer",
                        transition: "color 0.15s ease",
                      }}
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => onSelectAlert(alert)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        backgroundColor: isCritical ? "#FFFFFF" : "#1A1A20",
                        color: isCritical ? "#000000" : "#FFFFFF",
                        border: isCritical ? "none" : "1px solid rgba(255, 255, 255, 0.2)",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Investigate →
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
