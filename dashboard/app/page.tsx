"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getModelMetrics } from "@/lib/api";
import type { EvaluationReport } from "@/lib/types";
import { falseAlerts, falseAlertsBreakdown } from "@/lib/falseAlerts";
import { SplineSceneBasic } from "@/components/ui/demo";


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

  // Every number on this page comes from the evaluation report (live API, or the
  // snapshot of our last training run when it is offline). None is typed in here.
  const [report, setReport] = useState<EvaluationReport | null>(null);
  useEffect(() => {
    getModelMetrics().then(setReport).catch(() => setReport(null));
  }, []);
  const testFlows = report?.rows?.test ?? 0;
  const unknownPct = report
    ? (report.novel_families.shown_as_unknown ?? report.novel_families.caught_by_anomaly_detector) * 100
    : 0;
  // classifier and anomaly detector together: what an analyst actually gets
  const fa = report ? falseAlerts(report) : null;
  const dataLabel = !report
    ? "evaluation report unavailable"
    : `live report${report.synthetic_data ? " · synthetic data" : ""}`;

  const flowsCounted = useCountUp(testFlows, 1600, statsInView && testFlows > 0);
  const unknownCounted = useCountUp(Math.round(unknownPct * 10), 1600, statsInView && unknownPct > 0);

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


      {/* ── HERO SECTION ───────────────────────────────────────── */}
      <section
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 10,
        }}
        className="lg:h-screen"
      >
        {/* ── SPLINE 3D INTERACTIVE HERO ─────────────────────── */}
        <div className="reveal-init stagger-2 w-full h-full flex-1 flex flex-col">
          <SplineSceneBasic />
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
              Held-Out Flows Scored
            </div>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: "6px" }}>
              {testFlows ? flowsCounted.toLocaleString() : "—"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
              From 5-minute time blocks the model never trained on ({dataLabel}).
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
              Never-Seen Attacks Shown as Unknown
            </div>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: "6px" }}>
              {unknownPct ? `${(unknownCounted / 10).toFixed(1)}%` : "—"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
              Families held out of training entirely, flagged instead of mislabelled as a known attack.
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
              False Alerts per 10k Normal Flows
            </div>
            <div style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: "6px" }}>
              {fa ? fa.per10k : "—"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>
              {fa
                ? `${falseAlertsBreakdown(fa)}. Thresholds come from that budget, not a default 0.5.`
                : "Thresholds come from a false-alert budget, not a default 0.5."}
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
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
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
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
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
                  NetWatch tunes thresholds against an analyst false-alert budget
                  {fa ? ` (≤ ${fa.budgetPer10k} per 10k normal flows, classifier and anomaly detector together)` : ""}.
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
