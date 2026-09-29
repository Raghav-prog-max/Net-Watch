"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  bgColor: string;
  textColor?: string;
  onClick?: () => void;
  badge?: string;
  trendIcon?: string;
  trendText?: string;
}

export default function StatCard({
  label,
  value,
  subtext,
  bgColor,
  textColor,
  onClick,
  badge,
  trendIcon,
  trendText,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "20px",
        borderRadius: "16px",
        backgroundColor: "#0E0E12",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "140px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease",
      }}
    >
      {/* Top: Label & Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", fontWeight: 500, color: "#8E909B" }}>{label}</span>
        {badge && (
          <span style={{
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            backgroundColor: badge === "ACTION REQ" ? "#FFFFFF" : "#1A1A20",
            color: badge === "ACTION REQ" ? "#000000" : "#FFFFFF",
            border: badge === "ACTION REQ" ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
            letterSpacing: "0.04em",
          }}>
            {badge}
          </span>
        )}
      </div>

      {/* Center: Big Number + Trend */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <span style={{
            fontSize: "30px",
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}>
            {value}
          </span>
          {trendIcon && trendText && (
            <span style={{ display: "flex", alignItems: "center", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#E1E4EA", fontWeight: 600 }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px", marginRight: "2px" }}>{trendIcon}</span>
              {trendText}
            </span>
          )}
        </div>
        {subtext && (
          <p style={{ fontSize: "12px", color: "#8E909B", marginTop: "8px", margin: "8px 0 0" }}>{subtext}</p>
        )}
      </div>
    </div>
  );
}
