"use client";

import { useState } from "react";
import type { Alert } from "@/lib/types";

interface AlertModalProps {
  alert: Alert | null;
  onClose: () => void;
  onTriage: (id: string, status: Alert["status"]) => void;
}

export default function AlertModal({ alert, onClose, onTriage }: AlertModalProps) {
  if (!alert) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#17171B",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px",
          position: "relative",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
          border: "1px solid #26262C",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span
                className={`nw-pill ${
                  alert.severity.level === "Critical"
                    ? "nw-pill-amber"
                    : alert.severity.level === "High"
                    ? "nw-pill-purple"
                    : "nw-pill-lime"
                }`}
              >
                {alert.severity.level.toUpperCase()} · SCORE {alert.severity.score}
              </span>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
                {(alert.prediction.confidence * 100).toFixed(1)}% CONFIDENCE
              </span>
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 4px", color: "var(--nw-text-primary)" }}>
              {alert.prediction.family} {alert.is_novel && "· Novel Zero-Day"}
            </h2>
            <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
              Flow ID: <span className="mono">{alert.id}</span> · {alert.timestamp}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "none",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Source / Destination banner */}
        <div
          style={{
            backgroundColor: "#111114",
            borderRadius: "14px",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          <div>
            <span style={{ color: "var(--nw-text-muted)" }}>SRC: </span>
            <span style={{ color: "#FFFFFF" }}>{alert.flow.src_ip ?? "192.168.10.50"}</span>
          </div>
          <span style={{ color: "var(--nw-card-2)" }}>→</span>
          <div>
            <span style={{ color: "var(--nw-text-muted)" }}>DST: </span>
            <span style={{ color: "#FFFFFF" }}>{alert.flow.dst_ip ?? "172.16.0.1"}:{alert.flow.dst_port ?? "80"}</span>
          </div>
          <div>
            <span style={{ color: "var(--nw-text-muted)" }}>PROTO: </span>
            <span style={{ color: "var(--nw-card-3)" }}>{alert.flow.protocol ?? "TCP"}</span>
          </div>
        </div>

        {/* MITRE Playbook Box */}
        <div
          style={{
            backgroundColor: "rgba(167, 139, 250, 0.08)",
            borderRadius: "16px",
            padding: "14px 18px",
            marginBottom: "20px",
            border: "1px solid rgba(167, 139, 250, 0.15)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-2)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            MITRE ATT&amp;CK // {alert.mitre.tactic}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {alert.mitre.technique}
          </div>
          <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
            {alert.recommended_action}
          </div>
        </div>

        {/* SHAP Feature Attribution Bars */}
        <div style={{ marginBottom: "22px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--nw-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "10px" }}>
            Why Model Flagged Flow (SHAP Attribution)
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {alert.explanation.map((item) => {
              const absImpact = Math.abs(item.impact);
              const maxImp = Math.max(...alert.explanation.map((e) => Math.abs(e.impact)), 0.01);
              const pct = Math.min(100, Math.max(8, (absImpact / maxImp) * 100));

              return (
                <div key={item.feature} style={{ backgroundColor: "#111114", borderRadius: "12px", padding: "8px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, color: "var(--nw-text-primary)" }}>{item.feature}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--nw-card-2)" }}>
                      {item.impact > 0 ? "+" : ""}{item.impact.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ height: "4px", backgroundColor: "rgba(255, 255, 255, 0.08)", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        backgroundColor: item.impact > 0 ? "var(--nw-card-1)" : "var(--nw-card-3)",
                        borderRadius: "9999px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Triage Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", borderTop: "1px solid #26262C", paddingTop: "18px" }}>
          <button
            onClick={() => {
              onTriage(alert.id, "false_positive");
              onClose();
            }}
            className="nw-btn-pill nw-btn-amber"
            title="Mark as false positive to feed the v2 retraining dataset"
          >
            Mark False Positive
          </button>
          <button
            onClick={() => {
              onTriage(alert.id, "acknowledged");
              onClose();
            }}
            className="nw-btn-pill nw-btn-dark"
          >
            Acknowledge
          </button>
          <button
            onClick={() => {
              onTriage(alert.id, "escalated");
              onClose();
            }}
            className="nw-btn-pill nw-btn-soft-purple"
          >
            Escalate to IR
          </button>
          <button
            onClick={() => {
              onTriage(alert.id, "resolved");
              onClose();
            }}
            className="nw-btn-pill nw-btn-lime"
            style={{ marginLeft: "auto" }}
          >
            Resolve
          </button>
        </div>
      </div>
    </div>
  );
}
