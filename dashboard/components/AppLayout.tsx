"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import SocSidebar from "./SocSidebar";
import SocTopBar from "./SocTopBar";
import { useUser } from "@/lib/userContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { isAuthenticated, authLoading } = useUser();

  const isPublicPage = pathname === "/" || pathname === "/login";

  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isPublicPage) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, isPublicPage, router]);

  if (isPublicPage) {
    return <div className="landing-root">{children}</div>;
  }

  // Protect internal SOC pages: show auth loader until Firebase resolves
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "#050508",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: "var(--font-mono)",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "2px solid rgba(255, 255, 255, 0.1)",
            borderTopColor: "#FFFFFF",
            animation: "socSpin 0.7s linear infinite",
          }}
        />
        <div style={{ fontSize: "11px", color: "#8E909B", letterSpacing: "0.08em" }}>
          VERIFYING FIREBASE CREDENTIALS // NETWATCH SEC-OPS
        </div>
        <style jsx>{`
          @keyframes socSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If not authenticated and waiting for redirect, do not render protected dashboard
  if (!isAuthenticated) {
    return null;
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
