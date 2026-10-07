"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard caught an error:", error);
  }, [error]);

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "40px" }}>
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "20px",
          padding: "32px",
          border: "1px solid rgba(255, 100, 100, 0.3)",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 12px", color: "var(--nw-card-1)" }}>
          Dashboard Display Error
        </h1>
        <p style={{ color: "var(--nw-text-muted)", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
          The page crashed while rendering telemetry data. This usually happens if the backend API returns metrics in an unexpected shape (e.g. missing fields causing <code>.toFixed()</code> to fail).
        </p>
        
        <div style={{ backgroundColor: "#111114", padding: "16px", borderRadius: "12px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#FF8F8F", marginBottom: "24px", overflowX: "auto" }}>
          {error.message}
        </div>

        <button
          onClick={() => reset()}
          className="nw-btn-pill nw-btn-purple"
          style={{ padding: "10px 20px" }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
