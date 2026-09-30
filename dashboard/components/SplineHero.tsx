'use client'

import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card";
import { Spotlight } from "@/components/ui/spotlight";
import Link from "next/link";

/**
 * SplineHero — the interactive 3D hero card for the NetWatch landing page.
 * Replaces the static mini-preview card in the hero section.
 */
export function SplineHero() {
  return (
    <Card
      className="w-full relative overflow-hidden border-0"
      style={{
        height: "520px",
        background: "var(--nw-bg-panel)",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
      }}
    >
      {/* Mouse-follow spotlight */}
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" size={300} />

      <div className="flex h-full">
        {/* ── Left content panel ── */}
        <div
          className="flex flex-col justify-center relative z-10"
          style={{
            flex: "0 0 42%",
            padding: "40px 36px",
          }}
        >
          {/* Status pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              marginBottom: "18px",
              padding: "5px 14px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              backgroundColor: "rgba(167,139,250,0.13)",
              color: "var(--nw-card-2)",
              width: "fit-content",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: "#4ade80",
                boxShadow: "0 0 6px #4ade80",
                display: "inline-block",
              }}
            />
            LIVE ANALYSIS ACTIVE
          </div>

          {/* Headline */}
          <h2
            style={{
              fontSize: "clamp(22px, 2.6vw, 34px)",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              margin: "0 0 14px",
              background: "linear-gradient(160deg, #F5F5F7 0%, #8A8A93 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Interactive
            <br />
            3D Threat
            <br />
            Intelligence
          </h2>

          {/* Body */}
          <p
            style={{
              fontSize: "13px",
              color: "var(--nw-text-muted)",
              lineHeight: 1.65,
              margin: "0 0 28px",
              maxWidth: "300px",
            }}
          >
            Visualise real-time network attack vectors in three dimensions.
            LightGBM + Isolation Forest — two engines working together to surface
            threats your classifier has never seen.
          </p>

          {/* Mini stat row */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
            {[
              { label: "Engines", value: "2×", color: "var(--nw-card-1)" },
              { label: "Auto-Blocks", value: "0%", color: "var(--nw-card-3)" },
              { label: "Explainable", value: "✓", color: "var(--nw-card-2)" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: s.color,
                    lineHeight: 1,
                    marginBottom: "3px",
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "var(--nw-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              href="/dashboard"
              className="nw-btn-pill nw-btn-purple"
              style={{ padding: "10px 22px", fontSize: "13px", fontWeight: 700 }}
            >
              Launch SOC →
            </Link>
            <Link
              href="/evaluation"
              className="nw-btn-pill nw-btn-dark"
              style={{ padding: "10px 18px", fontSize: "13px" }}
            >
              View Proof
            </Link>
          </div>
        </div>

        {/* ── Right: Spline 3D scene ── */}
        <div className="relative" style={{ flex: 1 }}>
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />

          {/* Subtle left-edge fade to blend into the left panel */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              left: 0,
              width: "80px",
              background:
                "linear-gradient(to right, var(--nw-bg-panel), transparent)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        </div>
      </div>

      {/* Bottom data strip */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "10px 20px",
          backgroundColor: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            color: "var(--nw-text-muted)",
            letterSpacing: "0.08em",
          }}
        >
          CICIDS2017 · LEAKAGE-FREE TIME-BLOCK SPLIT · TREESHAP ATTRIBUTED
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {["DDoS", "BruteForce", "PortScan", "ZERO-DAY"].map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "9px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: "rgba(139,95,191,0.2)",
                color: "var(--nw-card-2)",
                letterSpacing: "0.04em",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
