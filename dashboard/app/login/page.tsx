"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { ROLE_DEFINITIONS } from "@/lib/users";
import type { UserRole } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const {
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    isAuthenticated,
    authLoading,
    isFirebaseConfigured,
  } = useUser();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("tier_2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated via Firebase, redirect straight to dashboard
  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        if (!email.trim() || !password) {
          setError("Please provide both email and password.");
          setLoading(false);
          return;
        }
        const res = await loginWithEmail(email, password);
        if (res.success) {
          router.push("/dashboard");
        } else {
          setError(res.error || "Login failed.");
        }
      } else {
        if (!name.trim() || !email.trim() || !password) {
          setError("Please fill in all registration fields.");
          setLoading(false);
          return;
        }
        const res = await registerWithEmail(name, email, password, role);
        if (res.success) {
          router.push("/dashboard");
        } else {
          setError(res.error || "Registration failed.");
        }
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        router.push("/dashboard");
      } else {
        setError(res.error || "Google sign-in failed.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
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
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            marginBottom: "12px",
          }}
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
          <span style={{ fontSize: "20px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
            NetWatch
          </span>
        </Link>
        <p style={{ margin: 0, fontSize: "12px", color: "#8E909B", fontFamily: "var(--font-mono)" }}>
          SEC-OPS INTRUSION DETECTION CONSOLE // RBAC AUTHENTICATION
        </p>

        {/* Firebase Connectivity Status Tag */}
        <div style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: isFirebaseConfigured ? "#10B981" : "#F59E0B",
              boxShadow: isFirebaseConfigured
                ? "0 0 8px rgba(16, 185, 129, 0.8)"
                : "0 0 8px rgba(245, 158, 11, 0.8)",
            }}
          />
          <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
            {isFirebaseConfigured ? "FIREBASE AUTH ONLINE" : "SANDBOX DEMO MODE (.env.local ready)"}
          </span>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#0E0E12",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          padding: "32px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Toggle Mode Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            backgroundColor: "#050508",
            padding: "4px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            style={{
              padding: "8px 0",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: mode === "login" ? 700 : 500,
              backgroundColor: mode === "login" ? "#FFFFFF" : "transparent",
              color: mode === "login" ? "#000000" : "#8E909B",
              transition: "all 0.15s ease",
            }}
          >
            Analyst Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            style={{
              padding: "8px 0",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: mode === "register" ? 700 : 500,
              backgroundColor: mode === "register" ? "#FFFFFF" : "transparent",
              color: mode === "register" ? "#000000" : "#8E909B",
              transition: "all 0.15s ease",
            }}
          >
            Provision Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#FCA5A5",
              fontSize: "12px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Sign In / Register Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "register" && (
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#8E909B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                Analyst Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Mercer"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  backgroundColor: "#141418",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#8E909B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
              Corporate Email (NetWatch Identity)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@netwatch.internal"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "#141418",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#FFFFFF",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#8E909B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "#141418",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#FFFFFF",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          {mode === "register" && (
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#8E909B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                Initial RBAC Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  backgroundColor: "#141418",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  outline: "none",
                }}
              >
                <option value="tier_1">Tier-1 // Triage Specialist</option>
                <option value="tier_2">Tier-2 // SecOps Analyst</option>
                <option value="tier_3">Tier-3 // Senior Responder</option>
                <option value="auditor">Auditor // Compliance &amp; Review</option>
                <option value="admin">Admin // SOC Lead</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              color: "#000000",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              cursor: loading ? "wait" : "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 2px 8px rgba(255, 255, 255, 0.1)",
            }}
          >
            {loading
              ? "Verifying SecOps Credentials..."
              : mode === "login"
              ? "Authenticate Session →"
              : "Provision NetWatch Analyst Account →"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", margin: "20px 0", gap: "10px" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255, 255, 255, 0.08)" }} />
          <span style={{ fontSize: "10px", color: "#656773", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>OR</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255, 255, 255, 0.08)" }} />
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || !isFirebaseConfigured}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: isFirebaseConfigured ? "#FFFFFF" : "#656773",
            fontSize: "12px",
            fontWeight: 600,
            cursor: isFirebaseConfigured ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.15s ease",
          }}
          title={isFirebaseConfigured ? "Sign in with Google" : "Configure Firebase API key in .env.local to enable Google OAuth"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span>Sign in with Google Enterprise</span>
        </button>
      </div>

      {/* Security Footer Notice */}
      <div style={{ marginTop: "24px", textAlign: "center", maxWidth: "420px" }}>
        <p style={{ margin: 0, fontSize: "11px", color: "#656773", lineHeight: 1.5 }}>
          Authorized NetWatch Personnel Only. All session attempts and token issuances are immutably logged to the SecOps SQLite audit registry.
        </p>
      </div>
    </div>
  );
}
