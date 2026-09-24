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
        padding: "20px 0 28px",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      {/* ── LEFT: GREETING & SUBTEXT ───────────────────────────── */}
      <div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--nw-text-primary)",
            margin: "0 0 4px",
          }}
        >
          Hello, Sarah Analyst 👋
        </h1>
        <p style={{ margin: 0, color: "var(--nw-text-muted)", fontSize: "13px" }}>
          Real-time network intrusion monitoring is active. 40 flows/s streaming.
        </p>
      </div>

      {/* ── RIGHT: SEARCH, NOTIFICATIONS, AVATAR ──────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search input with icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "9999px",
            padding: "8px 16px",
            width: "240px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--nw-text-muted)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search threats, IPs, tags..."
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--nw-text-primary)",
              fontSize: "12px",
              width: "100%",
            }}
          />
        </div>

        {/* Notification Bell */}
        <button
          onClick={() => setHasUnread(false)}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "var(--nw-bg-panel)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--nw-text-muted)",
            cursor: "pointer",
            position: "relative",
          }}
          aria-label="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          {hasUnread && (
            <span
              style={{
                position: "absolute",
                top: "9px",
                right: "9px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--nw-card-1)",
                border: "2px solid var(--nw-bg-panel)",
              }}
            />
          )}
        </button>

        {/* Avatar with status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "var(--nw-accent-purple)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "14px",
                border: "2px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              SA
            </div>
            <span
              style={{
                position: "absolute",
                bottom: "0",
                right: "0",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "var(--nw-card-3)",
                border: "2px solid var(--nw-bg-page)",
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
