"use client";

import Link from "next/link";

export default function LowerDetailCards() {
  const families = [
    { name: "DDoS Volumetric", count: "24,150", pct: 48, sev: "Critical", color: "var(--nw-card-1)" },
    { name: "PortScan Probing", count: "15,890", pct: 31, sev: "Medium", color: "var(--nw-card-2)" },
    { name: "DoS Endpoint Flood", count: "18,420", pct: 14, sev: "High", color: "var(--nw-card-1)" },
    { name: "Botnet C2 Beaconing", count: "1,960", pct: 4, sev: "High", color: "var(--nw-card-2)" },
    { name: "Novel Anomaly (Zero-Day)", count: "47", pct: 3, sev: "Critical", color: "var(--nw-card-3)" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "20px",
      }}
    >
      {/* ── CARD 1: TOP ATTACK FAMILIES ────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "22px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
                Top Attack Families
              </div>
              <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                Classified over 24-hour observation window
              </div>
            </div>
            <span className="nw-pill nw-pill-amber">6 FAMILIES</span>
          </div>

          {/* Rows of data */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {families.map((fam) => (
              <div key={fam.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: fam.color,
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                      {fam.name}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)" }}>
                    <strong style={{ color: "var(--nw-text-primary)" }}>{fam.count}</strong> flows
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "5px",
                    width: "100%",
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    borderRadius: "9999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${fam.pct}%`,
                      backgroundColor: fam.color,
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colored action button */}
        <div style={{ marginTop: "24px" }}>
          <Link
            href="/evaluation"
            className="nw-btn-pill nw-btn-purple"
            style={{ width: "100%" }}
          >
            View Evaluation &amp; LOFO Table →
          </Link>
        </div>
      </div>

      {/* ── CARD 2: ACTIVE MODEL & DRIFT HEALTH ────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "22px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--nw-text-primary)" }}>
                Active Model &amp; Drift Health
              </div>
              <div style={{ fontSize: "12px", color: "var(--nw-text-muted)", marginTop: "2px" }}>
                Production pipeline governance · v1-prod
              </div>
            </div>
            <span className="nw-pill nw-pill-lime">STABLE (PSI 0.048)</span>
          </div>

          {/* Rows of data */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Ensemble Architecture</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                LightGBM + Isolation Forest
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Operating Threshold</span>
              <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--nw-card-1)" }}>
                0.812 (FPR ≤ 50/10k)
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Leakage-Free Validation</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-card-3)" }}>
                5-Min Temporal Block (CI Verified)
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Novel Zero-Day Recall</span>
              <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--nw-card-2)" }}>
                93.6% (Held-Out Test)
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "14px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--nw-text-muted)" }}>Analyst Retraining Queue</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--nw-text-primary)" }}>
                12 False Positives Logged
              </span>
            </div>
          </div>
        </div>

        {/* Colored action button */}
        <div style={{ marginTop: "24px" }}>
          <Link
            href="/drift"
            className="nw-btn-pill nw-btn-lime"
            style={{ width: "100%" }}
          >
            Inspect Drift Monitor &amp; Retrain →
          </Link>
        </div>
      </div>
    </div>
  );
}
