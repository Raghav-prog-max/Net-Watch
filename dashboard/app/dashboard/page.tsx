"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StatCard from "@/components/StatCard";
import MainThreatChart from "@/components/MainThreatChart";
import LowerDetailCards from "@/components/LowerDetailCards";
import AlertRail from "@/components/AlertRail";
import AlertModal from "@/components/AlertModal";
import { ApiUnreachable, apiDownMessage, countAlerts, getModelMetrics, listAlerts, triage } from "@/lib/api";
import { subscribeToAlerts } from "@/lib/socket";
import type { Alert, EvaluationReport } from "@/lib/types";
import { useFalsePositiveCount } from "@/lib/useFalsePositiveCount";

interface AlertCounts {
  total: number;
  critical: number;
  open: number;
  novel: number;
}

function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((100 * part) / whole)}% of total` : "no alerts yet";
}

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const apiDownRef = useRef(false);
  const [fpTotal, refreshFpTotal] = useFalsePositiveCount();
  // Totals over the whole alert store. The alert list below holds only the latest
  // 100, so counting it would cap every card at 100.
  const [counts, setCounts] = useState<AlertCounts | null>(null);

  const loadAlerts = useCallback(() => {
    listAlerts({ limit: "100" })
      .then((a) => { setAlerts(a); apiDownRef.current = false; setApiDown(false); })
      .catch((e) => {
        setAlerts([]);
        apiDownRef.current = e instanceof ApiUnreachable;
        setApiDown(apiDownRef.current);
      });
  }, []);

  const refreshCounts = useCallback(() => {
    // novel alerts are exactly the ones shown as "Unknown" (ml/models/combine.py)
    Promise.all([
      countAlerts(),
      countAlerts({ severity: "Critical" }),
      countAlerts({ status: "open" }),
      countAlerts({ family: "Unknown" }),
    ])
      .then(([total, critical, open, novel]) => {
        setCounts({ total, critical, open, novel });
        // back after an outage: reload what the failed first load missed
        if (apiDownRef.current) loadAlerts();
        apiDownRef.current = false;
        setApiDown(false);
      })
      .catch((e) => {
        setCounts(null);
        // the banner follows this 5 s poll; it was set once at page load and
        // never appeared later nor cleared when the API came back
        if (e instanceof ApiUnreachable) {
          apiDownRef.current = true;
          setApiDown(true);
        }
      });
  }, [loadAlerts]);

  // polled rather than bumped per websocket alert: a replay sends ~60 alerts/s
  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 5000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  useEffect(() => {
    loadAlerts();
    getModelMetrics().then(setReport).catch(() => setReport(null));
    const unsubscribe = subscribeToAlerts((incomingAlert) => {
      setAlerts((prev) => [incomingAlert, ...prev.filter((a) => a.id !== incomingAlert.id)].slice(0, 100));
    });
    return () => unsubscribe();
  }, [loadAlerts]);

  async function handleTriage(id: string, status: Alert["status"]) {
    setTriageError(null);
    try {
      const updated = await triage(id, status, status === "false_positive" ? "Analyst FP" : undefined);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      refreshCounts();
      refreshFpTotal();
      // refresh the open alert only if it is still open: the modal closes as the
      // analyst clicks, and setting the value captured at click time reopened it
      setSelectedAlert((current) => (current?.id === id ? updated : current));
    } catch (e) {
      setTriageError(
        `Could not update ${id}: ${e instanceof Error ? e.message : "unknown error"}. Nothing was saved.`
      );
    }
  }

  const shown = (n: number | undefined | null) => (n == null ? "–" : n.toLocaleString());

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
            {apiDownMessage()}
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
          {/* Card 1: Critical Threats */}
          <StatCard
            label="Critical Threats"
            value={shown(counts?.critical)}
            subtext="Critical-severity alerts in the alert store"
            bgColor="#0E0E12"
            badge={counts && counts.critical > 0 ? "ACTION REQ" : undefined}
            trendIcon="pie_chart"
            trendText={counts ? share(counts.critical, counts.total) : undefined}
            onClick={() => {
              const crit = alerts.find((a) => a.severity.level === "Critical");
              if (crit) setSelectedAlert(crit);
            }}
          />

          {/* Card 2: Awaiting Triage */}
          <StatCard
            label="Awaiting Triage"
            value={shown(counts?.open)}
            subtext="Open alerts · nothing is auto-blocked"
            bgColor="#0E0E12"
            badge={counts ? (counts.open > 0 ? "PENDING" : "NOMINAL") : undefined}
            trendIcon="task_alt"
            trendText={counts ? `${((counts.total ?? 0) - (counts.open ?? 0)).toLocaleString()} triaged` : undefined}
          />

          {/* Card 3: Unknown / Novel Hits */}
          <StatCard
            label="Unknown (Novel)"
            value={shown(counts?.novel)}
            subtext="Alerts matching no known attack family"
            bgColor="#0E0E12"
            badge="ZERO-DAY"
            trendIcon="radar"
            trendText={counts ? share(counts.novel, counts.total) : undefined}
          />
        </div>

        {/* Main Threat Chart */}
        <MainThreatChart alerts={alerts} />

        {/* Lower Detail Cards */}
        <LowerDetailCards alerts={alerts} report={report} falsePositivesTotal={fpTotal} />
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
        @media (max-width: 1180px) {
          .stat-cards-grid {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
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
        @media (max-width: 768px) {
          .stat-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
