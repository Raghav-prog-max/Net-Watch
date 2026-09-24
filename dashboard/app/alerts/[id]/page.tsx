"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SeverityBadge from "@/components/SeverityBadge";
import ShapBar from "@/components/ShapBar";
import { getAlert, triage } from "@/lib/api";
import type { Alert } from "@/lib/types";

const ACTIONS: { label: string; status: Alert["status"]; btnClass: string }[] = [
  { label: "Acknowledge", status: "acknowledged", btnClass: "nw-btn-dark" },
  { label: "Escalate to IR", status: "escalated", btnClass: "nw-btn-soft-purple" },
  { label: "Mark False Positive", status: "false_positive", btnClass: "nw-btn-amber" },
  { label: "Resolve", status: "resolved", btnClass: "nw-btn-lime" },
];

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analystNote, setAnalystNote] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    getAlert(id)
      .then((a) => {
        setAlert(a);
        if (a.analyst_note) setAnalystNote(a.analyst_note);
      })
      .catch(() => setError("Alert not found."));
  }, [id]);

  async function handleApplyTriage(status: Alert["status"]) {
    setSaving(true);
    try {
      const updated = await triage(
        id,
        status,
        status === "false_positive" ? "Analyst FP" : undefined,
        analystNote || undefined
      );
      setAlert(updated);
      setSuccessToast(`Disposition updated to ${status.replace("_", " ")}`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch {
      setError("Could not update triage state.");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
        <button onClick={() => router.push("/alerts")} className="nw-btn-pill nw-btn-dark" style={{ marginBottom: "16px" }}>
          ← Back to Alerts
        </button>
        <div style={{ padding: "20px", backgroundColor: "rgba(244, 169, 62, 0.15)", borderRadius: "18px", color: "var(--nw-card-1)" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div style={{ padding: "40px", color: "var(--nw-text-muted)", fontFamily: "var(--font-mono)" }}>
        Loading forensic investigation...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px" }}>
      {/* ── TOP NAV ────────────────────────────────────────────── */}
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => router.push("/alerts")}
          className="nw-btn-pill nw-btn-dark"
        >
          ← Back to Alert Feed
        </button>

        <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
          Alert ID: <span className="mono" style={{ color: "#FFFFFF" }}>{alert.id}</span> · {alert.timestamp}
        </div>
      </div>

      {successToast && (
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: "rgba(167, 139, 250, 0.15)",
            borderRadius: "14px",
            color: "var(--nw-card-2)",
            fontSize: "13px",
            marginBottom: "18px",
          }}
        >
          ✓ {successToast}
        </div>
      )}

      {/* ── INCIDENT SUMMARY CARD ─────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "24px",
          padding: "26px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <SeverityBadge level={alert.severity.level} score={alert.severity.score} />
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--nw-text-primary)" }}>
              {alert.prediction.family} {alert.is_novel && "· Novel Anomaly"}
            </h1>
            {alert.also_abnormal && !alert.is_novel && (
              <span className="nw-pill nw-pill-purple" style={{ fontSize: "10px" }}>
                VARIANT PATTERN
              </span>
            )}
          </div>
          <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
            {alert.is_novel
              ? "No known attack matches this traffic, and it does not resemble normal benign baseline traffic."
              : `Classifier confidence ${(alert.prediction.confidence * 100).toFixed(1)}%. Anomaly percentile: ${alert.anomaly_score}.`}
          </div>
        </div>

        <div>
          <span
            className="nw-pill nw-pill-amber"
            style={{ fontSize: "12px", padding: "6px 16px", textTransform: "uppercase" }}
          >
            DISPOSITION: {alert.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* ── TWO-COLUMN FORENSICS ──────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Left Column: SHAP Features */}
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "26px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "14px" }}>
            SHAP Attribution Forensics (Why Model Fired)
          </div>

          <ShapBar items={alert.explanation} />

          <div
            style={{
              marginTop: "20px",
              padding: "14px",
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              borderRadius: "16px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <span style={{ color: "var(--nw-text-muted)" }}>ISOLATION SCORE: </span>
              <span>{alert.anomaly_score}</span>
            </div>
            <div>
              <span style={{ color: "var(--nw-text-muted)" }}>MODEL BUNDLE: </span>
              <span>{alert.model_version}</span>
            </div>
            <div>
              <span style={{ color: "var(--nw-text-muted)" }}>OUT OF FAMILY: </span>
              <span style={{ color: alert.is_novel ? "var(--nw-card-1)" : "var(--nw-card-3)" }}>
                {alert.is_novel ? "YES (OOD)" : "NO"}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--nw-text-muted)" }}>TRIGGER: </span>
              <span>{alert.is_novel ? "IsoForest Anomaly" : "Attack Threshold"}</span>
            </div>
          </div>
        </div>

        {/* Right Column: MITRE Tactics, Flow Telemetry, & Triage */}
        <div style={{ backgroundColor: "var(--nw-bg-panel)", borderRadius: "24px", padding: "26px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "14px" }}>
            Tactical Context &amp; Analyst Actions
          </div>

          {/* MITRE Card */}
          <div
            style={{
              backgroundColor: "rgba(167, 139, 250, 0.08)",
              borderRadius: "18px",
              padding: "16px 20px",
              marginBottom: "18px",
              border: "1px solid rgba(167, 139, 250, 0.15)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-2)", textTransform: "uppercase" }}>
              MITRE ATT&amp;CK TACTIC // {alert.mitre.tactic}
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", margin: "4px 0" }}>
              {alert.mitre.technique}
            </div>
            <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
              {alert.recommended_action}
            </div>
          </div>

          {/* Flow parameters */}
          <div
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              borderRadius: "16px",
              padding: "14px 18px",
              marginBottom: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {Object.entries(alert.flow).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "var(--nw-text-muted)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span className="mono" style={{ color: "#FFFFFF" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Analyst Note */}
          <div style={{ marginBottom: "18px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
              Analyst Triage Investigation Note:
            </div>
            <textarea
              value={analystNote}
              onChange={(e) => setAnalystNote(e.target.value)}
              placeholder="Document investigation context or root cause for the retraining audit log..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "14px",
                color: "#FFFFFF",
                fontSize: "12px",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {ACTIONS.map((a) => (
              <button
                key={a.status}
                disabled={saving || alert.status === a.status}
                onClick={() => handleApplyTriage(a.status)}
                className={`nw-btn-pill ${a.btnClass}`}
              >
                {saving ? "Saving..." : a.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "14px", fontSize: "11px", color: "var(--nw-text-muted)", borderTop: "1px solid #26262C", paddingTop: "10px" }}>
            Note: Marking a false positive adds a verified supervision label for v2 retraining.
            In accordance with doctrine, no network device or firewall rule is touched automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
