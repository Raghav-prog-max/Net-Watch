import Link from "next/link";

// An unknown path (an old /login bookmark, a mistyped alert URL) gets the console's
// look and a way back, not Next.js's unstyled default.
export default function NotFound() {
  return (
    <div style={{ padding: "60px 28px", maxWidth: "640px", margin: "0 auto" }}>
      <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--nw-text-muted)", marginBottom: "8px" }}>
        404
      </div>
      <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 10px", color: "var(--nw-text-primary)" }}>
        This page does not exist
      </h1>
      <p style={{ color: "var(--nw-text-muted)", fontSize: "13px", margin: "0 0 20px" }}>
        The console has no page at this address.
      </p>
      <Link href="/dashboard" className="nw-btn-pill nw-btn-primary">
        Go to the dashboard
      </Link>
    </div>
  );
}
