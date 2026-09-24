"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { broadcastSimulatedAlert } from "@/lib/socket";
import type { Alert } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "Overview", code: "00", sub: "Mission Briefing" },
  { href: "/alerts", label: "Alert Feed", code: "01", sub: "Live Ingestion" },
  { href: "/evaluation", label: "Evaluation", code: "02", sub: "LOFO & Honest Split" },
  { href: "/drift", label: "Drift Monitor", code: "03", sub: "PSI & Retrain Alert" },
  { href: "/models", label: "Model Registry", code: "04", sub: "v1 Active / Feedback" },
];

export default function SocShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [utcTime, setUtcTime] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live ticking UTC tactical clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        now.toISOString().replace("T", " ").replace("Z", " UTC").slice(0, 23)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Quick burst injection for interactive testing and presentation
  function handleInjectSimulatedBurst() {
    setIsSimulating(true);
    const families = ["DDoS", "WebAttack", "Infiltration", "PortScan", "Bot"];
    const chosenFamily = families[Math.floor(Math.random() * families.length)];
    const isNovel = chosenFamily === "Infiltration";
    const srcIp = `192.168.10.${Math.floor(Math.random() * 200) + 10}`;
    const dstIp = `172.16.0.${Math.floor(Math.random() * 10) + 1}`;
    const dstPort = isNovel ? "443" : chosenFamily === "WebAttack" ? "8080" : "80";

    const newAlert: Alert = {
      id: `alt_${Math.random().toString(16).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      flow: {
        src_ip: srcIp,
        dst_ip: dstIp,
        dst_port: dstPort,
        protocol: "TCP",
        truth: chosenFamily,
        duration: "0.95s",
        flow_bytes_s: "192400",
        fwd_packets: "340",
      },
      prediction: {
        family: isNovel ? "Unknown" : chosenFamily,
        confidence: isNovel ? 0.912 : 0.948,
      },
      anomaly_score: isNovel ? -0.384 : -0.245,
      is_novel: isNovel,
      also_abnormal: true,
      severity: {
        score: isNovel ? 92 : 88,
        level: "Critical",
      },
      explanation: [
        { feature: "Flow Bytes/s", value: 192400, impact: 0.44 },
        { feature: "Total Fwd Packets", value: 340, impact: 0.32 },
        { feature: "Flow IAT Mean", value: 12050, impact: -0.18 },
        { feature: "SYN Flag Count", value: 1, impact: 0.14 },
      ],
      mitre: isNovel
        ? { tactic: "Unmapped", technique: "Novel Anomaly (Analyst to classify)" }
        : chosenFamily === "DDoS"
        ? { tactic: "Impact", technique: "T1498 Network Denial of Service" }
        : chosenFamily === "WebAttack"
        ? { tactic: "Initial Access", technique: "T1190 Exploit Public-Facing Application" }
        : chosenFamily === "Bot"
        ? { tactic: "Command and Control", technique: "T1071 Application Layer Protocol" }
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
    setTimeout(() => setIsSimulating(false), 600);
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "var(--nw-surface-base)",
        color: "var(--nw-text)",
        position: "relative",
      }}
    >
      {/* ── LEFT SIDEBAR (Navy Surface) ───────────────────────── */}
      <aside
        style={{
          width: "250px",
          backgroundColor: "var(--nw-navy)",
          borderRight: "1px solid var(--nw-border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: 40,
        }}
        className={mobileMenuOpen ? "soc-sidebar-open" : "soc-sidebar-responsive"}
      >
        {/* Brand Console Header */}
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--nw-border)",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: "var(--nw-teal)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "15px",
                letterSpacing: "0.08em",
                color: "var(--nw-text)",
              }}
            >
              NETWATCH
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                padding: "1px 5px",
                background: "rgba(0, 106, 103, 0.3)",
                color: "var(--nw-teal)",
                border: "1px solid var(--nw-teal-border)",
              }}
            >
              SOC v1.0
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--nw-text-dim)",
              letterSpacing: "0.05em",
            }}
          >
            NETWORK INTRUSION CONSOLE
          </div>
        </div>

        {/* Tactical Nav Links */}
        <nav style={{ padding: "12px 0", flex: 1 }}>
          <div
            style={{
              padding: "0 18px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: "var(--nw-text-dim)",
              textTransform: "uppercase",
            }}
          >
            Tactical Views
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href) || (item.href === "/alerts" && pathname === "/dashboard");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  color: isActive ? "#FFFFFF" : "var(--nw-text-muted)",
                  backgroundColor: isActive ? "rgba(0, 106, 103, 0.25)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--nw-teal)" : "3px solid transparent",
                  borderBottom: "1px solid var(--nw-border-subtle)",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: isActive ? "var(--nw-teal)" : "var(--nw-text-dim)", fontSize: "11px" }}>
                      [{item.code}]
                    </span>
                    <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--nw-text-dim)", paddingLeft: "26px" }}>
                    {item.sub}
                  </div>
                </div>
                {isActive && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      backgroundColor: "var(--nw-teal)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Operating Rules Callout in Sidebar */}
        <div
          style={{
            margin: "12px",
            padding: "12px",
            background: "rgba(0, 11, 88, 0.7)",
            border: "1px solid var(--nw-border)",
            fontSize: "11px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: "10px",
              color: "var(--nw-cream)",
              letterSpacing: "0.06em",
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span>■</span> CORE DOCTRINE
          </div>
          <div style={{ color: "var(--nw-text-muted)", lineHeight: 1.4 }}>
            Zero automated blocking. Every row is an analyst triage decision.
          </div>
        </div>

        {/* System Footnote */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--nw-border)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--nw-text-dim)",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <div>SEC-OPS // TIER-1 CONSOLE</div>
          <div style={{ color: "var(--nw-teal)" }}>STATUS: ARMED &amp; LOGGING</div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA WITH TOP BAR ────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top SOC Status Bar */}
        <header
          style={{
            height: "54px",
            backgroundColor: "var(--nw-navy)",
            borderBottom: "1px solid var(--nw-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            gap: "14px",
            flexShrink: 0,
          }}
        >
          {/* Left: Mobile Toggle & System Armed Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="nw-btn nw-btn-ghost nw-btn-sm soc-mobile-toggle"
              aria-label="Toggle Navigation"
            >
              ☰ NAV
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="nw-status-dot teal pulsing" />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--nw-teal)",
                }}
              >
                SYSTEM ARMED
              </span>
              <span style={{ color: "var(--nw-text-dim)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                // INGESTION ACTIVE
              </span>
            </div>
          </div>

          {/* Right: Telemetry & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Rate & Model Pill (Hidden on mobile) */}
            <div className="soc-top-telemetry" style={{ display: "flex", gap: "14px", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
              <div>
                <span style={{ color: "var(--nw-text-dim)" }}>RATE: </span>
                <span style={{ color: "var(--nw-text)" }}>40 flows/s</span>
              </div>
              <div>
                <span style={{ color: "var(--nw-text-dim)" }}>MODEL: </span>
                <span style={{ color: "var(--nw-text)" }}>v1 (LightGBM+IF)</span>
              </div>
              <div>
                <span style={{ color: "var(--nw-text-dim)" }}>SPLIT: </span>
                <span style={{ color: "var(--nw-teal)" }}>5-min block (safe)</span>
              </div>
            </div>

            {/* Quick Simulate Burst Button */}
            <button
              onClick={handleInjectSimulatedBurst}
              disabled={isSimulating}
              className="nw-btn nw-btn-sm nw-btn-teal"
              title="Inject a realistic held-out attack flow into the live stream"
            >
              {isSimulating ? "INJECTING..." : "⚡ SIMULATE FLOW"}
            </button>

            {/* Live UTC Clock */}
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--nw-text-muted)",
                background: "rgba(0, 49, 97, 0.4)",
                border: "1px solid var(--nw-border)",
                padding: "3px 8px",
              }}
            >
              {utcTime || "INITIALIZING..."}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main
          style={{
            flex: 1,
            padding: "24px 28px 60px",
            maxWidth: "1600px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {children}
        </main>
      </div>

      <style jsx global>{`
        @media (max-width: 900px) {
          .soc-sidebar-responsive {
            display: none !important;
          }
          .soc-sidebar-open {
            position: fixed !important;
            top: 54px !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 250px !important;
            z-index: 100 !important;
          }
          .soc-top-telemetry {
            display: none !important;
          }
        }
        @media (min-width: 901px) {
          .soc-mobile-toggle {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
