"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/userContext";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  backgroundColor: "#141418",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#FFFFFF",
  fontSize: "13px",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  color: "#8E909B",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontFamily: "var(--font-mono)",
};

export default function LoginPage() {
  const router = useRouter();
  const { roster, isAuthenticated, authLoading, signIn, signInWithEmail } = useUser();
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  // already signed in: straight to the dashboard
  React.useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace("/dashboard");
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // a typed email wins over the picker
    const res = email.trim() ? signInWithEmail(email) : signIn(userId || roster[0]?.id || "");
    if (res.success) router.push("/dashboard");
    else setError(res.error ?? "Sign-in failed.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#050508",
        backgroundImage: "radial-gradient(circle at 50% 0%, rgba(139, 95, 191, 0.08) 0%, transparent 60%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "12px" }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              color: "#000000",
              fontWeight: 800,
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(255, 255, 255, 0.15)",
            }}
          >
            N
          </div>
          <span style={{ fontSize: "20px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>NetWatch</span>
        </Link>
        <p style={{ margin: 0, fontSize: "12px", color: "#8E909B", fontFamily: "var(--font-mono)" }}>
          SEC-OPS INTRUSION DETECTION CONSOLE
        </p>
      </div>

      {/* Sign-in card */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#0E0E12",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          padding: "32px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#FCA5A5",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>error</span>
            <span>{error}</span>
          </div>
        )}

        <div>
          <label style={labelStyle}>Analyst on shift</label>
          <select value={userId || roster[0]?.id || ""} onChange={(e) => setUserId(e.target.value)} style={fieldStyle}>
            {roster.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.department}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Or roster email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="analyst@netwatch.internal"
            style={fieldStyle}
          />
        </div>

        <button
          type="submit"
          style={{
            marginTop: "8px",
            padding: "12px",
            borderRadius: "10px",
            backgroundColor: "#FFFFFF",
            color: "#000000",
            fontWeight: 700,
            fontSize: "13px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(255, 255, 255, 0.1)",
          }}
        >
          Start Shift →
        </button>

        <p style={{ margin: 0, fontSize: "11px", color: "#656773", lineHeight: 1.5 }}>
          No password: picking an analyst names who triages the alerts, it does not secure the console.
          Writes to the API are protected by its own key.
        </p>
      </form>
    </div>
  );
}
