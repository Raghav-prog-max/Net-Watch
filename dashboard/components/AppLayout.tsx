"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import SocSidebar from "./SocSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // If on Landing Page "/", render full width marketing/onboarding experience
  if (pathname === "/") {
    return <div className="landing-root">{children}</div>;
  }

  // Dashboard views: render with dark sidebar and ambient purple glow
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "var(--nw-bg-page)",
        position: "relative",
      }}
    >
      {/* ── DESKTOP & MOBILE SIDEBAR ─────────────────────────── */}
      <div className={`soc-sidebar-container ${mobileDrawerOpen ? "open" : ""}`}>
        <SocSidebar />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            zIndex: 90,
          }}
        />
      )}

      {/* ── MAIN CONTENT WORKSPACE ────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Mobile top trigger bar below 1024px */}
        <div className="soc-mobile-header" style={{ display: "none" }}>
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            style={{
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ☰
          </button>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF" }}>NetWatch</span>
          <div style={{ width: "24px" }} />
        </div>

        <main style={{ flex: 1 }}>{children}</main>
      </div>

      <style jsx global>{`
        @media (max-width: 1024px) {
          .soc-sidebar-container {
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: -220px !important;
            z-index: 100 !important;
            transition: left 0.25s ease !important;
          }
          .soc-sidebar-container.open {
            left: 0 !important;
          }
          .soc-mobile-header {
            display: flex !important;
            align-items: center;
            justifyContent: space-between;
            padding: 14px 20px;
            background-color: var(--nw-bg-panel);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
        }
      `}</style>
    </div>
  );
}
