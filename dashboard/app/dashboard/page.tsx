"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import MainThreatChart from "@/components/MainThreatChart";
import LowerDetailCards from "@/components/LowerDetailCards";
import AlertRail from "@/components/AlertRail";
import AlertModal from "@/components/AlertModal";
import { ApiUnreachable, getDrift, getModelMetrics, getModelRegistryInfo, listAlerts, triage } from "@/lib/api";
import { subscribeToAlerts } from "@/lib/socket";
import type { Alert, DriftStatus, EvaluationReport } from "@/lib/types";

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [drift, setDrift] = useState<DriftStatus | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [fpTotal, setFpTotal] = useState<number | null>(null);

  useEffect(() => {
    listAlerts({ limit: "100" })
      .then((a) => { setAlerts(a); setApiDown(false); })
      .catch((e) => { setAlerts([]); setApiDown(e instanceof ApiUnreachable); });
    getModelRegistryInfo().then((m) => setFpTotal(m.feedback?.false_positive ?? null)).catch(() => setFpTotal(null));
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
    <div style={{
      display: "flex",
      width: "100%",
      flex: 1,
    }}>
      {/* ── LEFT/CENTER WORKSPACE ─────────────────────────────── */}
      <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "calc(100vw - 240px - 380px)" }} className="workspace-container">
        
        {apiDown && (
          <div role="alert" style={{
            padding: "12px 20px", backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "12px",
            color: "#FFFFFF", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px"
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>warning</span>
            The API is not reachable on :8000. Start it with <code>make api</code> to see live data.
          </div>
        )}

        {triageError && (
          <div role="alert" style={{
            padding: "12px 20px", backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "12px",
            color: "#FFFFFF", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px"
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>error</span>
            {triageError}
          </div>
        )}

        {/* Top KPI Metric Cards (3 Columns) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }} className="stat-cards-grid">
          {/* Card 1: Critical Threats Active */}
          <StatCard
            label="Critical Threats Active"
            value={criticalCount}
            subtext="Requires immediate containment protocols"
            bgColor="#0E0E12"
            badge="ACTION REQ"
            trendIcon="trending_up"
            trendText="+14% / hr"
            onClick={() => {
              const crit = alerts.find((a) => a.severity.level === "Critical");
              if (crit) setSelectedAlert(crit);
            }}
          />

          {/* Card 2: Awaiting Triage */}
          <StatCard
            label="Awaiting Triage"
            value={openCount}
            subtext="Mean inspection time: 4.2 mins / cluster"
            bgColor="#0E0E12"
            badge="NOMINAL"
            trendIcon="trending_down"
            trendText="-5% backlog"
          />

          {/* Card 3: Unknown Novel Hits */}
          <StatCard
            label="Unknown (Never Seen)"
            value={novelCount}
            subtext="Unsupervised autoencoder anomaly hits"
            bgColor="#0E0E12"
            badge="ZERO-DAY"
            trendIcon="blur_on"
            trendText={`${novelCount} Novel Sig`}
          />
        </div>

        {/* Main Threat Chart */}
        <MainThreatChart alerts={alerts} />

        {/* Lower Detail Cards */}
        <LowerDetailCards alerts={alerts} report={report} drift={drift} falsePositivesTotal={fpTotal} />
      </div>

      {/* ── RIGHT RAIL (Alert Feed) ────────────────────────────── */}
      <aside
        style={{
          width: "380px",
          backgroundColor: "#0E0E12",
          borderLeft: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 64px)", /* 100vh minus TopBar */
          position: "sticky",
          top: "64px",
          flexShrink: 0,
        }}
        className="alert-rail-container"
      >
        <AlertRail
          alerts={alerts}
          onSelectAlert={(al) => setSelectedAlert(al)}
          onTriage={handleTriage}
        />
      </aside>

      {/* Modal Inspector for Alert details */}
      <AlertModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onTriage={handleTriage}
      />

      <style jsx global>{`
        @media (max-width: 1300px) {
          .alert-rail-container {
            width: 320px !important;
          }
          .workspace-container {
            max-width: calc(100vw - 240px - 320px) !important;
          }
        }
        @media (max-width: 1024px) {
          .alert-rail-container {
            display: none !important;
          }
          .workspace-container {
            max-width: 100% !important;
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
