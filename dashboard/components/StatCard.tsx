"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  bgColor?: string;
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
  bgColor = "#0E0E12",
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
        padding: "18px 20px",
        borderRadius: "16px",
        backgroundColor: bgColor,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "148px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
        if (onClick) e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
        if (onClick) e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Top: Label & Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#8E909B",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={label}
        >
          {label}
        </span>
        {badge && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px 8px",
              borderRadius: "9999px",
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
              flexShrink: 0,
              lineHeight: "16px",
              backgroundColor:
                badge === "ACTION REQ"
                  ? "#FFFFFF"
                  : badge === "NOMINAL"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(255, 255, 255, 0.08)",
              color:
                badge === "ACTION REQ"
                  ? "#000000"
                  : badge === "NOMINAL"
                  ? "#10B981"
                  : "#FFFFFF",
              border:
                badge === "ACTION REQ"
                  ? "none"
                  : badge === "NOMINAL"
                  ? "1px solid rgba(16, 185, 129, 0.3)"
                  : "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: badge === "ACTION REQ" ? "0 2px 6px rgba(0, 0, 0, 0.25)" : "none",
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Center: Big Number + Trend */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: textColor || "#FFFFFF",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              fontFamily: "var(--font-sans, system-ui, sans-serif)",
            }}
          >
            {value}
          </span>
          {trendText && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "#E1E4EA",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {trendIcon && (
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "15px",
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      trendIcon === "pie_chart" || trendIcon === "donut_large"
                        ? "#C4C6CB"
                        : trendIcon === "task_alt"
                        ? "#10B981"
                        : "#8E909B",
                  }}
                >
                  {trendIcon}
                </span>
              )}
              <span>{trendText}</span>
            </span>
          )}
        </div>
        {subtext && (
          <p
            style={{
              fontSize: "12px",
              color: "#8E909B",
              marginTop: "8px",
              marginBottom: 0,
              lineHeight: 1.4,
            }}
          >
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
