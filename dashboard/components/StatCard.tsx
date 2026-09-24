"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  bgColor: string;
  textColor?: string;
  onClick?: () => void;
}

export default function StatCard({
  label,
  value,
  subtext,
  bgColor,
  textColor = "#111114",
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: bgColor,
        borderRadius: "22px",
        padding: "24px 26px",
        color: textColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "155px",
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* Top: Small label */}
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        {label}
      </div>

      {/* Center/Bottom: Big bold number and subtext */}
      <div style={{ marginTop: "14px", marginBottom: "4px" }}>
        <div
          style={{
            fontSize: "36px",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </div>
        {subtext && (
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              opacity: 0.75,
              marginTop: "4px",
            }}
          >
            {subtext}
          </div>
        )}
      </div>

      {/* Bottom-right: Near-black circle button with arrow (sitting on bright card) */}
      <div
        style={{
          position: "absolute",
          right: "20px",
          bottom: "20px",
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          backgroundColor: "var(--nw-card-circle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          transition: "transform 0.15s ease",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="7" y1="17" x2="17" y2="7"></line>
          <polyline points="7 7 17 7 17 17"></polyline>
        </svg>
      </div>
    </div>
  );
}
