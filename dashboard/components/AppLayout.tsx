"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import SocSidebar from "./SocSidebar";
import SocTopBar from "./SocTopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpenOn, setDrawerOpenOn] = useState<string | null>(null);
  const mobileDrawerOpen = drawerOpenOn === pathname;
  const setMobileDrawerOpen = (open: boolean) => setDrawerOpenOn(open ? pathname : null);

  // the landing page has no app chrome; there is no sign-in page
  const isPublicPage = pathname === "/";

  if (isPublicPage) {
    return <div className="landing-root">{children}</div>;
  }


  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--nw-bg-page)" }}>
      {/* ── SIDEBAR ────────────────────────────────────────── */}
      <div
        className={`soc-sidebar-container ${mobileDrawerOpen ? "open" : ""}`}
        style={{ zIndex: 40 }}
      >
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
            zIndex: 35,
          }}
        />
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="soc-main-content" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Mobile top trigger bar below 1024px */}
        <div className="soc-mobile-header" style={{ display: "none" }}>
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            aria-label={mobileDrawerOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileDrawerOpen}
            style={{
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              fontSize: "24px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF" }}>NetWatch</span>
          <div style={{ width: "40px" }} />
        </div>

        <SocTopBar />
        
        <main style={{ flex: 1, minWidth: 0, width: "100%", display: "flex", flexDirection: "column" }}>
          {children}
        </main>
      </div>

      <style jsx global>{`
        .soc-sidebar-container {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 240px;
          height: 100vh;
          flex-shrink: 0;
          z-index: 40;
        }
        .soc-main-content {
          margin-left: 240px;
          flex: 1;
          min-width: 0;
          max-width: calc(100vw - 240px);
          width: calc(100% - 240px);
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        @media (max-width: 1024px) {
          .soc-sidebar-container {
            left: -240px !important;
            z-index: 100 !important;
            transition: left 0.25s ease !important;
          }
          .soc-sidebar-container.open {
            left: 0 !important;
          }
          .soc-main-content {
            margin-left: 0 !important;
            max-width: 100vw !important;
            width: 100% !important;
          }
          .soc-main-content header {
            display: none !important;
          }
          .soc-mobile-header {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background-color: var(--nw-bg-panel);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
        }
      `}</style>
    </div>
  );
}
