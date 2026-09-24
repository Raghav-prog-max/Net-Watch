"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function SocSidebar() {
  const pathname = usePathname();
  const [escalated, setEscalated] = useState(false);

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1"></rect>
          <rect x="14" y="3" width="7" height="5" rx="1"></rect>
          <rect x="14" y="12" width="7" height="9" rx="1"></rect>
          <rect x="3" y="16" width="7" height="5" rx="1"></rect>
        </svg>
      ),
    },
    {
      href: "/alerts",
      label: "Alerts",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
    },
    {
      href: "/evaluation",
      label: "Evaluation",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      ),
    },
    {
      href: "/drift",
      label: "Drift",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
    },
    {
      href: "/models",
      label: "Models",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      ),
    },
  ];

  const bottomItems = [
    {
      href: "/",
      label: "Landing Page",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
    },
    {
      href: "#",
      label: "Log out",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      ),
    },
  ];

  return (
    <aside
      style={{
        width: "210px",
        backgroundColor: "var(--nw-bg-panel)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexShrink: 0,
        minHeight: "100vh",
        padding: "24px 0",
        borderRight: "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      {/* ── TOP: LOGO & NAV ────────────────────────────────────── */}
      <div>
        {/* Brand logo top-left */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "0 22px",
            marginBottom: "36px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              backgroundColor: "var(--nw-accent-purple)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "16px",
            }}
          >
            N
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.01em", color: "#FFFFFF" }}>
              NetWatch
            </div>
            <div style={{ fontSize: "10px", color: "var(--nw-text-muted)", letterSpacing: "0.04em" }}>
              AI SEC-OPS
            </div>
          </div>
        </Link>

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/alerts"
                : pathname === item.href;

            return (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "11px 22px",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#FFFFFF" : "var(--nw-text-muted)",
                  backgroundColor: isActive ? "rgba(139, 95, 191, 0.12)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--nw-accent-purple)" : "3px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ color: isActive ? "var(--nw-card-2)" : "inherit" }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── BOTTOM: PROMO / CTA CARD & FOOTER LINKS ───────────── */}
      <div style={{ padding: "0 16px" }}>
        {/* Purple gradient promo / CTA block (repurposed for Escalate to SOC lead) */}
        <div
          style={{
            background: "linear-gradient(145deg, #8B5FBF 0%, #633B94 100%)",
            borderRadius: "18px",
            padding: "18px 16px",
            color: "#FFFFFF",
            marginBottom: "20px",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(139, 95, 191, 0.25)",
          }}
        >
          {/* Subtle decoration circle */}
          <div
            style={{
              position: "absolute",
              top: "-15px",
              right: "-15px",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            }}
          />

          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "10px",
            }}
          >
            🛡️
          </div>

          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>
            Escalate Incident
          </div>
          <div style={{ fontSize: "11px", opacity: 0.85, lineHeight: 1.4, marginBottom: "12px" }}>
            Direct uplink to Tier-2 Lead for confirmed zero-day anomalies.
          </div>

          <button
            onClick={() => {
              setEscalated(true);
              setTimeout(() => setEscalated(false), 3000);
            }}
            style={{
              width: "100%",
              padding: "7px 12px",
              backgroundColor: "#FFFFFF",
              color: "#633B94",
              borderRadius: "9999px",
              border: "none",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              transition: "transform 0.15s ease",
            }}
          >
            {escalated ? "✓ Lead Alerted" : "Escalate to Lead"}
          </button>
        </div>

        {/* Bottom items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {bottomItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                fontSize: "12px",
                color: "var(--nw-text-muted)",
                borderRadius: "10px",
                transition: "all 0.15s ease",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
