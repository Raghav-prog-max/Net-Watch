"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SocSidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/alerts", label: "Alerts", icon: "notifications_active", badge: true },
    { href: "/evaluation", label: "Evaluation", icon: "fact_check" },
    { href: "/drift", label: "Drift", icon: "timeline" },
    { href: "/models", label: "Models", icon: "model_training" },
    { href: "/users", label: "Users & RBAC", icon: "manage_accounts" },
  ];

  const bottomItems = [
    { href: "/", label: "Landing Page", icon: "public" },
    { href: "#", label: "Log out", icon: "logout" },
  ];

  return (
    <aside
      data-lenis-prevent
      style={{
        width: "100%",
        backgroundColor: "#0E0E12",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        overflowY: "auto",
        padding: "16px 0",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* ── TOP: LOGO & NAV ──────────────────────── */}
      <div>
        {/* Brand Header */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "0 20px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000000",
              fontWeight: 800,
              fontSize: "16px",
              boxShadow: "0 2px 8px rgba(255, 255, 255, 0.1)",
            }}
          >
            N
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
              NetWatch
            </div>
            <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "#8E909B", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
              AI SEC-OPS
            </div>
          </div>
        </Link>

        {/* Nav Items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "16px" }}>
          {navItems.map((item) => {
            const isActive =
              item.href === "/alerts"
                ? pathname === "/alerts" || pathname.startsWith("/alerts/")
                : pathname === item.href;

            return (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "10px 20px",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#FFFFFF" : "#8E909B",
                  backgroundColor: isActive ? "#141418" : "transparent",
                  borderLeft: isActive ? "2px solid #FFFFFF" : "2px solid transparent",
                  transition: "all 0.15s ease",
                  letterSpacing: "0.02em",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "19px",
                      color: isActive ? "#FFFFFF" : "inherit",
                      fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span style={{
                    padding: "2px 8px",
                    fontSize: "10px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    borderRadius: "9999px",
                    backgroundColor: "#1A1A20",
                    color: "#E1E4EA",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}>
                    •
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── BOTTOM: PROMO & FOOTER LINKS ────────── */}
      <div style={{ padding: "0 16px" }}>
        {/* Escalate Incident Card */}
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            backgroundColor: "#141418",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#FFFFFF" }}>crisis_alert</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#E1E4EA", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Escalate Incident
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "#8E909B", lineHeight: 1.5, marginBottom: "12px", margin: "0 0 12px" }}>
            High confidence threat requires Tier-3 intervention.
          </p>
          <Link
            href="/alerts"
            style={{
              display: "block",
              textAlign: "center",
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "#FFFFFF",
              color: "#000000",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 6px rgba(255, 255, 255, 0.08)",
              transition: "all 0.15s ease",
            }}
          >
            Review Alerts to Escalate →
          </Link>
        </div>

        {/* Footer Links */}
        <div style={{ paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", flexDirection: "column", gap: "4px" }}>
          {bottomItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 12px",
                fontSize: "12px",
                color: "#8E909B",
                transition: "color 0.15s ease",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
