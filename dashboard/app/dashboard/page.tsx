"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import MainThreatChart from "@/components/MainThreatChart";
import LowerDetailCards from "@/components/LowerDetailCards";
import AlertRail from "@/components/AlertRail";
import AlertModal from "@/components/AlertModal";
import SocTopBar from "@/components/SocTopBar";
import { listAlerts, triage } from "@/lib/api";
import { subscribeToAlerts, broadcastSimulatedAlert } from "@/lib/socket";
import type { Alert } from "@/lib/types";

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    listAlerts({ limit: "50" }).then(setAlerts);
    const unsubscribe = subscribeToAlerts((incomingAlert) => {
      setAlerts((prev) => [incomingAlert, ...prev.filter((a) => a.id !== incomingAlert.id)].slice(0, 100));
    });
    return () => unsubscribe();
  }, []);

  async function handleTriage(id: string, status: Alert["status"]) {
    try {
      const updated = await triage(id, status, status === "false_positive" ? "Analyst FP" : undefined);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      if (selectedAlert?.id === id) {
        setSelectedAlert(updated);
      }
    } catch {
      // offline fallback
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status, analyst_label: status === "false_positive" ? "Analyst FP" : a.analyst_label } : a
        )
      );
    }
  }

  function handleInjectTestFlow() {
    const families = ["DDoS", "WebAttack", "Infiltration", "PortScan", "Bot"];
    const chosen = families[Math.floor(Math.random() * families.length)];
    const isNovel = chosen === "Infiltration";
    const src = `192.168.10.${Math.floor(Math.random() * 200) + 10}`;

    const newAlert: Alert = {
      id: `alt_${Math.random().toString(16).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      flow: {
        src_ip: src,
        dst_ip: "172.16.0.1",
        dst_port: isNovel ? "443" : chosen === "WebAttack" ? "8080" : "80",
        protocol: "TCP",
        truth: chosen,
        duration: "0.85s",
        flow_bytes_s: "184000",
        fwd_packets: "1920",
      },
      prediction: {
        family: isNovel ? "Unknown" : chosen,
        confidence: isNovel ? 0.912 : 0.965,
      },
      anomaly_score: isNovel ? -0.375 : -0.264,
      is_novel: isNovel,
      also_abnormal: true,
      severity: {
        score: isNovel ? 91 : 88,
        level: "Critical",
      },
      explanation: [
        { feature: "Flow Bytes/s", value: 184000, impact: 0.42 },
        { feature: "Total Fwd Packets", value: 1920, impact: 0.31 },
        { feature: "Flow IAT Mean", value: 18400, impact: -0.19 },
      ],
      mitre: isNovel
        ? { tactic: "Unmapped", technique: "Zero-Day Anomaly (Analyst to classify)" }
        : chosen === "DDoS"
        ? { tactic: "Impact", technique: "T1498 Network Denial of Service" }
        : chosen === "WebAttack"
        ? { tactic: "Initial Access", technique: "T1190 Exploit Public-Facing Application" }
        : { tactic: "Discovery", technique: "T1046 Network Service Discovery" },
      recommended_action: isNovel
        ? "Zero-day deviation pattern. Review payload and isolate endpoint."
        : "Investigate target service and verify firewall telemetry.",
      status: "open",
      analyst_label: null,
      analyst_note: null,
      model_version: "v1",
    };

    broadcastSimulatedAlert(newAlert);
  }

  const criticalCount = alerts.filter((a) => a.severity.level === "Critical").length;

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 28px 60px" }}>
      {/* Top greeting bar */}
      <SocTopBar />

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
              value={criticalCount > 0 ? criticalCount : 24}
              subtext="+3 in past hour · Sev ≥ 85"
              bgColor="var(--nw-card-1)"
              onClick={() => {
                const crit = alerts.find((a) => a.severity.level === "Critical");
                if (crit) setSelectedAlert(crit);
              }}
            />

            {/* Card 2: Soft Purple (#A78BFA) - Flows Analyzed */}
            <StatCard
              label="Network Flows (24H)"
              value="482.5K"
              subtext="40 flows/sec · Zero packet drop"
              bgColor="var(--nw-card-2)"
            />

            {/* Card 3: Lime Green (#C7DB6E) - Model Confidence / Integrity */}
            <StatCard
              label="Model Integrity"
              value="98.4%"
              subtext="≤50/10k FPR · PSI 0.048 stable"
              bgColor="var(--nw-card-3)"
            />
          </div>

          {/* Main Chart Card */}
          <MainThreatChart />

          {/* Two lower detail breakdown cards */}
          <LowerDetailCards />
        </div>

        {/* ── RIGHT COLUMN: SCROLLABLE ALERT CARDS STACK ─────── */}
        <div style={{ position: "sticky", top: "20px" }}>
          <AlertRail
            alerts={alerts}
            onSelectAlert={(al) => setSelectedAlert(al)}
            onTriage={handleTriage}
            onInjectTestFlow={handleInjectTestFlow}
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
