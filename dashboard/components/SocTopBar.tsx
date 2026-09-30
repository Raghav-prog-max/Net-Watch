"use client";

import { useState } from "react";

export default function SocTopBar() {
  const [hasUnread, setHasUnread] = useState(true);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: "64px",
        backgroundColor: "rgba(5, 5, 8, 0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {/* ── LEFT: GREETING & STATUS ───────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h1 style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", margin: 0, letterSpacing: "-0.01em" }}>
            Hello, Sarah Analyst
          </h1>
          <span style={{ fontSize: "12px", color: "#8E909B" }}>•</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#8E909B" }}>NODE-ONLINE</span>
        </div>
        <p style={{ margin: 0, fontSize: "11px", color: "#8E909B" }}>
          Real-time network intrusion monitoring &amp; automated triage
        </p>
      </div>

      {/* ── RIGHT: SEARCH, NOTIFICATIONS, AVATAR ──── */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search Input */}
        <div style={{ position: "relative", width: "320px" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "12px", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "17px", color: "#656773" }}>search</span>
          </div>
          <input
            type="text"
            placeholder="Search threats, IPs, tags..."
            style={{
              width: "100%",
              paddingLeft: "36px",
              paddingRight: "56px",
              paddingTop: "6px",
              paddingBottom: "6px",
              borderRadius: "9999px",
              backgroundColor: "#0E0E12",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#FFFFFF",
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
          />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: "10px", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <kbd style={{
              padding: "2px 6px",
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              borderRadius: "4px",
              backgroundColor: "#1A1A20",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#8E909B",
            }}>⌘K</kbd>
          </div>
        </div>

        {/* Notification Bell */}
        <button
          onClick={() => setHasUnread(false)}
          style={{
            position: "relative",
            padding: "8px",
            borderRadius: "50%",
            backgroundColor: "transparent",
            border: "none",
            color: "#8E909B",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
          }}
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>notifications</span>
          {hasUnread && (
            <span style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
            }} />
          )}
        </button>

        {/* User Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingLeft: "12px", borderLeft: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "#1A1A20",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              SA
            </div>
            <span style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
              border: "2px solid #050508",
            }} />
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF", lineHeight: 1.2 }}>Sarah Analyst</div>
            <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>Tier-2 SecOps</div>
          </div>
        </div>
      </div>
    </header>
  );
}
