"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import MainThreatChart from "@/components/MainThreatChart";
import LowerDetailCards from "@/components/LowerDetailCards";
import AlertRail from "@/components/AlertRail";
import AlertModal from "@/components/AlertModal";
import SocTopBar from "@/components/SocTopBar";
import { getDrift, getModelMetrics, listAlerts, triage } from "@/lib/api";
import { subscribeToAlerts } from "@/lib/socket";
import type { Alert, DriftStatus, EvaluationReport } from "@/lib/types";

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [drift, setDrift] = useState<DriftStatus | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);

  useEffect(() => {
    listAlerts({ limit: "100" }).then(setAlerts).catch(() => setAlerts([]));
    getModelMetrics().then(setReport).catch(() => setReport(null));
    getDrift().then(setDrift).catch(() => setDrift(null));
    const unsubscribe = subscribeToAlerts((incomingAlert) => {
      setAlerts((prev) => [incomingAlert, ...prev.filter((a) => a.id !== incomingAlert.id)].slice(0, 100));
    });
    return () => unsubscribe();
  }, []);

  async function handleTriage(id: string, status: Alert["status"]) {
    setTriageError(null);
    try {
      const updated = await triage(id, status, status === "false_positive" ? "Analyst FP" : undefined);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      if (selectedAlert?.id === id) {
        setSelectedAlert(updated);
      }
    } catch (e) {
      setTriageError(
        `Could not update ${id}: ${e instanceof Error ? e.message : "unknown error"}. Nothing was saved.`
      );
    }
  }

  const criticalCount = alerts.filter((a) => a.severity.level === "Critical").length;
  const openCount = alerts.filter((a) => a.status === "open").length;
  const novelCount = alerts.filter((a) => a.is_novel).length;

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 28px 60px" }}>
      {/* Top greeting bar */}
      <SocTopBar />

      {triageError && (
        <div role="alert" style={{
            padding: "10px 18px",
            backgroundColor: "rgba(244, 169, 62, 0.12)",
            border: "1px solid rgba(244, 169, 62, 0.35)",
            borderRadius: "14px",
            color: "var(--nw-card-1)",
            fontSize: "13px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
          <span>▲</span> {triageError}
        </div>
      )}

      {/* Main 2-column layout (center wide column + right rail) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "24px",
          alignItems: "start",
        }}
        className="dashboard-columns-grid"
      >
        {/* ── LEFT/CENTER COLUMN: STATS + CHART + LOWER CARDS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Row of 3 colorful stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "20px",
            }}
            className="stat-cards-grid"
          >
            {/* Card 1: Amber (#F4A93E) - Critical Alerts */}
            <StatCard
              label="Critical Threats Active"
              value={criticalCount}
              subtext={`of ${alerts.length} alerts loaded · Sev ≥ 85`}
              bgColor="var(--nw-card-1)"
              onClick={() => {
                const crit = alerts.find((a) => a.severity.level === "Critical");
                if (crit) setSelectedAlert(crit);
              }}
            />

            {/* Card 2: Soft Purple (#A78BFA) - Awaiting triage */}
            <StatCard
              label="Awaiting Triage"
              value={openCount}
              subtext="open alerts · nothing is auto-blocked"
              bgColor="var(--nw-card-2)"
            />

            {/* Card 3: Lime Green (#C7DB6E) - Never-seen traffic */}
            <StatCard
              label="Unknown (Never Seen)"
              value={novelCount}
              subtext="alerts matching no known attack family"
              bgColor="var(--nw-card-3)"
            />
          </div>

          {/* Main Chart Card */}
          <MainThreatChart alerts={alerts} />

          {/* Two lower detail breakdown cards */}
          <LowerDetailCards alerts={alerts} report={report} drift={drift} />
        </div>

        {/* ── RIGHT COLUMN: SCROLLABLE ALERT CARDS STACK ─────── */}
        <div style={{ position: "sticky", top: "20px" }}>
          <AlertRail
            alerts={alerts}
            onSelectAlert={(al) => setSelectedAlert(al)}
            onTriage={handleTriage}
          />
        </div>
      </div>

      {/* Modal Inspector for Alert details */}
      <AlertModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onTriage={handleTriage}
      />

      <style jsx global>{`
        @media (max-width: 1200px) {
          .dashboard-columns-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 800px) {
          .stat-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
