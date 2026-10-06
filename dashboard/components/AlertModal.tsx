"use client";

import type { Alert } from "@/lib/types";

interface AlertModalProps {
  alert: Alert | null;
  onClose: () => void;
  onTriage: (id: string, status: Alert["status"]) => void;
}

export default function AlertModal({ alert, onClose, onTriage }: AlertModalProps) {
  if (!alert) return null;

  const isCritical = alert.severity.level === "Critical";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#0E0E12",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────── */}
        <div style={{
          padding: "24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          backgroundColor: "#141418",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                padding: "2px 10px",
                borderRadius: "4px",
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                backgroundColor: isCritical ? "#FFFFFF" : "#1A1A20",
                color: isCritical ? "#000000" : "#FFFFFF",
                border: isCritical ? "none" : "1px solid rgba(255, 255, 255, 0.15)",
              }}>
                {alert.severity.level.toUpperCase()} · SCORE {alert.severity.score}
              </span>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#1A1A20",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "2px 10px",
                borderRadius: "4px",
              }}>
                {(alert.prediction.confidence * 100).toFixed(1)}% Confidence
              </span>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
                #{alert.id.slice(0, 8)}
              </span>
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#FFFFFF", margin: 0, letterSpacing: "-0.02em" }}>
              {alert.prediction.family} {alert.is_novel && "· Novel Zero-Day"}
            </h2>
            <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
              {alert.timestamp}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "transparent",
              border: "1px solid transparent",
              color: "#8E909B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>

        {/* ── BODY ────────────────────────────── */}
        <div style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxHeight: "720px",
          overflowY: "auto",
          backgroundColor: "#0E0E12",
        }} className="custom-scroll">

          {/* Network Telemetry Banner */}
          <div style={{
            padding: "14px",
            borderRadius: "12px",
            backgroundColor: "#050508",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "#E1E4EA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#FFFFFF" }}>router</span>
              <span style={{ letterSpacing: "-0.01em" }}>
                SRC: {alert.flow.src_ip ?? "—"} → DST: {alert.flow.dst_ip ?? "—"}:{alert.flow.dst_port ?? "—"} | PROTO: {alert.flow.protocol ?? "—"}
              </span>
            </div>
            <span style={{
              padding: "2px 8px",
              fontSize: "9px",
              borderRadius: "4px",
              backgroundColor: "#FFFFFF",
              color: "#000000",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>
              LIVE
            </span>
          </div>

          {/* MITRE ATT&CK Box */}
          <div style={{
            padding: "16px",
            borderRadius: "12px",
            backgroundColor: "#141418",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#FFFFFF" }}>security</span>
              <span>MITRE ATT&amp;CK Mapping</span>
            </div>
            <div style={{ fontSize: "12px", color: "#E1E4EA", lineHeight: 1.6 }}>
              <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>Tactic:</strong> {alert.mitre.tactic} · <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>Technique:</strong> {alert.mitre.technique}
            </div>
            <p style={{
              fontSize: "12px",
              color: "#8E909B",
              backgroundColor: "#0E0E12",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              lineHeight: 1.6,
              margin: 0,
            }}>
              <strong style={{ color: "#E1E4EA", fontWeight: 500 }}>Automated Recommendation:</strong> {alert.recommended_action}
            </p>
          </div>

          {/* SHAP Feature Attribution */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.02em", textTransform: "uppercase", fontFamily: "var(--font-mono)", margin: 0 }}>
                  SHAP Feature Attribution
                </h4>
                <p style={{ fontSize: "11px", color: "#8E909B", margin: "2px 0 0" }}>Model explainability weights</p>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#656773" }}>Local Impact (Φ)</span>
            </div>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              backgroundColor: "#141418",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              {alert.explanation.map((item) => {
                const absImpact = Math.abs(item.impact);
                const maxImp = Math.max(...alert.explanation.map((e) => Math.abs(e.impact)), 0.01);
                const pct = Math.min(100, Math.max(8, (absImpact / maxImp) * 100));

                // Monochromatic bar gradient based on intensity
                const barColor = pct > 70 ? "#FFFFFF" : pct > 50 ? "#C4C6CB" : pct > 30 ? "#8E909B" : pct > 15 ? "#656773" : "#35353F";
                const textColor = pct > 50 ? "#FFFFFF" : pct > 30 ? "#E1E4EA" : "#8E909B";

                return (
                  <div key={item.feature} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    <span style={{ width: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: textColor }}>{item.feature}</span>
                    <div style={{ flex: 1, margin: "0 16px", backgroundColor: "#050508", height: "8px", borderRadius: "9999px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <div style={{ backgroundColor: barColor, height: "100%", borderRadius: "9999px", width: `${pct}%`, transition: "width 0.3s ease" }} />
                    </div>
                    <span style={{ width: "56px", textAlign: "right", fontWeight: 700, color: textColor }}>
                      {item.impact > 0 ? "+" : ""}{item.impact.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── FOOTER: TRIAGE BUTTONS ──────────── */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          backgroundColor: "#141418",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <button
            onClick={() => { onTriage(alert.id, "false_positive"); onClose(); }}
            style={{
              padding: "8px 16px",
              borderRadius: "9999px",
              backgroundColor: "#0E0E12",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#FFFFFF";
              e.currentTarget.style.color = "#000000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#0E0E12";
              e.currentTarget.style.color = "#FFFFFF";
            }}
          >
            Mark False Positive
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => { onTriage(alert.id, "acknowledged"); onClose(); }}
              style={{
                padding: "8px 16px",
                borderRadius: "9999px",
                backgroundColor: "#1A1A20",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#8E909B",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#FFFFFF";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8E909B";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              }}
            >
              Acknowledge
            </button>
            <button
              onClick={() => { onTriage(alert.id, "escalated"); onClose(); }}
              style={{
                padding: "8px 16px",
                borderRadius: "9999px",
                backgroundColor: "#23232A",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.16)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#23232A";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "15px",
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                warning
              </span>
              Escalate to IR
            </button>
            <button
              onClick={() => { onTriage(alert.id, "resolved"); onClose(); }}
              style={{
                padding: "8px 20px",
                borderRadius: "9999px",
                backgroundColor: "#FFFFFF",
                color: "#000000",
                border: "none",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(255, 255, 255, 0.1)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#E1E4EA";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#FFFFFF";
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "15px",
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                check_circle
              </span>
              Resolve Incident
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
