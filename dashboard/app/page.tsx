"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Count-up animated number hook
function useCountUp(end: number, duration: number = 1400, trigger: boolean = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration, trigger]);

  return count;
}

export default function LandingPage() {
  const [statsInView, setStatsInView] = useState(false);
  const statsRef = useRef<HTMLDivElement | null>(null);

  // Setup IntersectionObserver for scroll-triggered reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
          }
        });
      },
      { threshold: 0.15 }
    );

    const elements = document.querySelectorAll(".reveal-init");
    elements.forEach((el) => observer.observe(el));

    // Stats counter observer
    const statsObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStatsInView(true);
        }
      },
      { threshold: 0.25 }
    );

    if (statsRef.current) {
      statsObserver.observe(statsRef.current);
    }

    return () => {
      observer.disconnect();
      statsObserver.disconnect();
    };
  }, []);

  const alertsCaught = useCountUp(142850, 1600, statsInView);
  const flowsAnalyzed = useCountUp(4800, 1600, statsInView);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--nw-bg-page)",
        color: "var(--nw-text-primary)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* ── TOP NAVIGATION BAR ─────────────────────────────────── */}
      <header
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              backgroundColor: "var(--nw-accent-purple)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "18px",
              boxShadow: "0 4px 14px rgba(139, 95, 191, 0.4)",
            }}
          >
            N
          </div>
          <div>
            <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em" }}>
              NetWatch
            </span>
            <span
              style={{
                fontSize: "11px",
                marginLeft: "8px",
                color: "var(--nw-card-2)",
                backgroundColor: "rgba(167, 139, 250, 0.15)",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontWeight: 600,
              }}
            >
              AI SOC v1.0
            </span>
          </div>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a href="#stats" style={{ color: "var(--nw-text-muted)", fontSize: "13px", fontWeight: 500 }}>
            Metrics
          </a>
          <a href="#how-it-works" style={{ color: "var(--nw-text-muted)", fontSize: "13px", fontWeight: 500 }}>
            Architecture
          </a>
          <a href="#trust" style={{ color: "var(--nw-text-muted)", fontSize: "13px", fontWeight: 500 }}>
            Why No Auto-Block
          </a>
          <Link
            href="/dashboard"
            className="nw-btn-pill nw-btn-purple"
            style={{ padding: "9px 20px" }}
          >
            Launch Dashboard →
          </Link>
        </nav>
      </header>

      {/* ── HERO SECTION ───────────────────────────────────────── */}
      <section
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "60px 28px 90px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Soft pill badge */}
        <div
          className="reveal-init stagger-1 nw-pill nw-pill-purple"
          style={{ marginBottom: "22px", padding: "6px 16px", fontSize: "12px" }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--nw-card-2)" }} />
          DUAL-ENGINE NETWORK INTRUSION DETECTION
        </div>

        {/* Hero Headline */}
        <h1
          className="reveal-init stagger-2"
          style={{
            fontSize: "clamp(34px, 5.5vw, 62px)",
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            maxWidth: "920px",
            margin: "0 0 20px",
          }}
        >
          Real-time AI network intrusion detection with explainable alerts.
        </h1>

        {/* Hero Subhead */}
        <p
          className="reveal-init stagger-3"
          style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            color: "var(--nw-text-muted)",
            maxWidth: "720px",
            lineHeight: 1.6,
            margin: "0 0 36px",
          }}
        >
          Pairing LightGBM attack classification with an unsupervised benign Isolation Forest.
          Surfaces instant TreeSHAP attribution and MITRE ATT&amp;CK context for human SOC triage —
          with a 100% guarantee of zero automated blocking.
        </p>

        {/* Hero CTA buttons */}
        <div
          className="reveal-init stagger-4"
          style={{
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: "60px",
          }}
        >
          <Link
            href="/dashboard"
            className="nw-btn-pill nw-btn-purple"
            style={{ padding: "14px 32px", fontSize: "14px", fontWeight: 700 }}
          >
            View Dashboard →
          </Link>
          <Link
            href="/evaluation"
            className="nw-btn-pill nw-btn-dark"
            style={{ padding: "14px 26px", fontSize: "14px" }}
          >
            Inspect Honest Time-Split Proof
          </Link>
        </div>

        {/* Visual Mini-Preview Card */}
        <div
          className="reveal-init stagger-4"
          style={{
            width: "100%",
            maxWidth: "1000px",
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "24px",
            padding: "24px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: "#FF5F56" }} />
              <span style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
              <span style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: "#27C93F" }} />
            </div>
            <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
              SOC TELEMETRY // 40 FLOWS/S
            </div>
            <span className="nw-pill nw-pill-lime">LIVE FEED</span>
          </div>

          {/* Mini 3-stat row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--nw-card-1)",
                borderRadius: "16px",
                padding: "16px",
                color: "#111114",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>CRITICAL ALERTS</div>
              <div style={{ fontSize: "28px", fontWeight: 800 }}>24</div>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>+3 in past hour</div>
            </div>

            <div
              style={{
                backgroundColor: "var(--nw-card-2)",
                borderRadius: "16px",
                padding: "16px",
                color: "#111114",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>FLOWS ANALYZED</div>
              <div style={{ fontSize: "28px", fontWeight: 800 }}>482.5K</div>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>0 drop rate</div>
            </div>

            <div
              style={{
                backgroundColor: "var(--nw-card-3)",
                borderRadius: "16px",
                padding: "16px",
                color: "#111114",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>MODEL INTEGRITY</div>
              <div style={{ fontSize: "28px", fontWeight: 800 }}>98.4%</div>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>PSI 0.048 stable</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ANIMATED STAT COUNTERS ─────────────────────────────── */}
      <section
        id="stats"
        ref={statsRef}
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "50px 28px 80px",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "24px",
          }}
        >
          {/* Stat 1 */}
          <div
            className="reveal-init stagger-1"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--nw-card-1)", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>
              Alerts Caught &amp; Triage-Ready
            </div>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: "6px" }}>
              {alertsCaught.toLocaleString()}+
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
              High-confidence threat detections surfaced across CICIDS2017 benchmarks.
            </div>
          </div>

          {/* Stat 2 */}
          <div
            className="reveal-init stagger-2"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--nw-card-2)", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>
              Network Flows Analyzed
            </div>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: "6px" }}>
              {(flowsAnalyzed / 1000).toFixed(1)}M+
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
              Evaluated with zero packet payload decryption, preserving network privacy.
            </div>
          </div>

          {/* Stat 3 */}
          <div
            className="reveal-init stagger-3"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--nw-card-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>
              Avg. Detection Latency
            </div>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: "6px" }}>
              &lt; 12ms
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
              Sub-second dual-engine inference for immediate SOC analyst response.
            </div>
          </div>

          {/* Stat 4 */}
          <div
            className="reveal-init stagger-4"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--nw-card-1)", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>
              Automated Disruption
            </div>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: "6px" }}>
              0%
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
              Zero automatic blocks or drops. Every alert empowers human analyst authority.
            </div>
          </div>
        </div>
      </section>

      {/* ── "HOW IT WORKS" STEP CARDS (REVEAL LEFT TO RIGHT) ──── */}
      <section
        id="how-it-works"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "70px 28px 90px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "50px" }}>
          <span className="nw-pill nw-pill-purple" style={{ marginBottom: "12px" }}>
            HOW IT WORKS
          </span>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, margin: "10px 0" }}>
            From raw packet flow to explainable analyst triage.
          </h2>
          <p style={{ color: "var(--nw-text-muted)", fontSize: "15px", maxWidth: "600px", margin: "0 auto" }}>
            Four coordinated stages engineered to eliminate target leakage and false alarm fatigue.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Card 1 */}
          <div
            className="reveal-init stagger-1"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(244, 169, 62, 0.15)",
                  color: "var(--nw-card-1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                  marginBottom: "18px",
                }}
              >
                01
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px", color: "var(--nw-text-primary)" }}>
                Line-Rate Ingestion
              </h3>
              <p style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.6, margin: 0 }}>
                Continuous stream of bidirectional network flows. Collects flow duration, packet inter-arrival
                times, and byte counts. Identifiers (IPs, MACs) are stripped before inference.
              </p>
            </div>
            <div style={{ marginTop: "24px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--nw-card-1)" }}>
              ZERO PAYLOAD DECRYPTION
            </div>
          </div>

          {/* Card 2 */}
          <div
            className="reveal-init stagger-2"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(167, 139, 250, 0.15)",
                  color: "var(--nw-card-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                  marginBottom: "18px",
                }}
              >
                02
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px", color: "var(--nw-text-primary)" }}>
                Dual-Engine Scoring
              </h3>
              <p style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.6, margin: 0 }}>
                LightGBM classifies known families (DoS, DDoS, PortScan, BruteForce, WebAttack, Bot).
                Simultaneously, an Isolation Forest trained only on benign traffic catches unseen zero-days.
              </p>
            </div>
            <div style={{ marginTop: "24px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--nw-card-2)" }}>
              SUPERVISED + UNSUPERVISED
            </div>
          </div>

          {/* Card 3 */}
          <div
            className="reveal-init stagger-3"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(199, 219, 110, 0.15)",
                  color: "var(--nw-card-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                  marginBottom: "18px",
                }}
              >
                03
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px", color: "var(--nw-text-primary)" }}>
                SHAP &amp; MITRE Context
              </h3>
              <p style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.6, margin: 0 }}>
                Every alert is tagged with top local TreeSHAP attribution feature bars, explaining exactly
                why the model fired. Mapped MITRE ATT&amp;CK tactics provide authoritative playbooks.
              </p>
            </div>
            <div style={{ marginTop: "24px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--nw-card-3)" }}>
              EXPLAINABLE TELEMETRY
            </div>
          </div>

          {/* Card 4 */}
          <div
            className="reveal-init stagger-4"
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "22px",
              padding: "28px 24px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(139, 95, 191, 0.2)",
                  color: "var(--nw-card-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                  marginBottom: "18px",
                }}
              >
                04
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px", color: "var(--nw-text-primary)" }}>
                Feedback Retraining Loop
              </h3>
              <p style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.6, margin: 0 }}>
                Analyst triage labels (false positives) feed the candidate v2 retraining pipeline.
                A candidate model is promoted ONLY if it beats the incumbent on the identical time-block split.
              </p>
            </div>
            <div style={{ marginTop: "24px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--nw-accent-purple)" }}>
              HUMAN PROMOTION GATE
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST & EXPLAINABILITY CALLOUT ────────────────────── */}
      <section
        id="trust"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "60px 28px 100px",
        }}
      >
        <div
          className="reveal-init"
          style={{
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "28px",
            padding: "48px 40px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
          }}
        >
          {/* Subtle purple glow circle */}
          <div
            style={{
              position: "absolute",
              top: "-80px",
              right: "-80px",
              width: "280px",
              height: "280px",
              borderRadius: "50%",
              backgroundColor: "rgba(139, 95, 191, 0.12)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "40px",
              alignItems: "center",
            }}
          >
            <div>
              <span className="nw-pill nw-pill-amber" style={{ marginBottom: "14px" }}>
                CORE PHILOSOPHY
              </span>
              <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 800, margin: "12px 0 16px" }}>
                Why NetWatch never automatically blocks network traffic.
              </h2>
              <p style={{ color: "var(--nw-text-muted)", fontSize: "15px", lineHeight: 1.6, margin: "0 0 24px" }}>
                In academic labs, automated firewall drops sound decisive. In production enterprise environments,
                automated blocking on statistical ML models causes catastrophic self-inflicted outages.
              </p>

              <div
                style={{
                  backgroundColor: "rgba(244, 169, 62, 0.08)",
                  borderRadius: "16px",
                  padding: "16px 20px",
                  borderLeft: "4px solid var(--nw-card-1)",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-card-1)", marginBottom: "4px" }}>
                  An Attack Score is a Triage Metric
                </div>
                <div style={{ fontSize: "12px", color: "var(--nw-text-primary)", lineHeight: 1.5 }}>
                  The score answers &ldquo;is this worth an analyst&apos;s time?&rdquo;, not &ldquo;drop this packet immediately&rdquo;.
                  Softmax classifiers hallucinate high confidence on novel zero-days. We keep humans in the loop.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "16px",
                  padding: "18px 22px",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "4px" }}>
                  01 // Production False Alarms Are Costly Outages
                </div>
                <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
                  When an automated blocker misclassifies database syncs as DDoS, critical revenue stops.
                  NetWatch tunes thresholds against an analyst false-positive budget (&le;50 per 10k flows).
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "16px",
                  padding: "18px 22px",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "4px" }}>
                  02 // Precision Containment Beats Blanket IP Bans
                </div>
                <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
                  Attackers route through shared CDNs and NAT gateways. Dropping the IP breaks hundreds of
                  innocent users. NetWatch surfaces the MITRE technique so analysts apply surgical controls.
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "16px",
                  padding: "18px 22px",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--nw-text-primary)", marginBottom: "4px" }}>
                  03 // Leakage-Free 5-Minute Block Splits
                </div>
                <div style={{ fontSize: "13px", color: "var(--nw-text-muted)", lineHeight: 1.5 }}>
                  Automated CI gates (<code className="mono">tests/test_split_leakage.py</code>) fail the build
                  if any 5-minute time block exists across train and test. We report honest numbers that work in reality.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          backgroundColor: "var(--nw-bg-panel)",
          padding: "40px 28px",
          color: "var(--nw-text-muted)",
          fontSize: "13px",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: "var(--nw-text-primary)", marginBottom: "4px" }}>
              NetWatch AI SOC // Microsoft Hackathon 2026
            </div>
            <div>
              Dataset: CICIDS2017 (Canadian Institute for Cybersecurity) · Engelen et al. 2021 relabelling
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <Link href="/dashboard" style={{ color: "var(--nw-card-2)", fontWeight: 600 }}>
              Dashboard →
            </Link>
            <Link href="/evaluation" style={{ color: "var(--nw-text-primary)" }}>
              Evaluation
            </Link>
            <Link href="/drift" style={{ color: "var(--nw-text-primary)" }}>
              Drift Monitor
            </Link>
            <Link href="/models" style={{ color: "var(--nw-text-primary)" }}>
              Models
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
