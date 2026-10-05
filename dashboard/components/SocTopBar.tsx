import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { ROLE_DEFINITIONS } from "@/lib/users";

export default function SocTopBar() {
  const [hasUnread, setHasUnread] = useState(true);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentUser, users, switchUserById } = useUser();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roleDef = ROLE_DEFINITIONS[currentUser.role] || ROLE_DEFINITIONS.tier_2;

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
            Hello, {currentUser.name}
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

        {/* User Avatar with Dropdown Persona Switcher */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              paddingLeft: "12px",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
            aria-label="User Profile Menu"
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: currentUser.avatarColor,
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
                {currentUser.initials}
              </div>
              <span style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10B981",
                border: "2px solid #050508",
              }} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF", lineHeight: 1.2 }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
                {roleDef.title}
              </div>
            </div>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "18px",
                color: "#8E909B",
                transform: userDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            >
              expand_more
            </span>
          </button>

          {/* Interactive User Switcher Menu */}
          {userDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "280px",
                backgroundColor: "#141418",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "16px",
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
                padding: "16px",
                zIndex: 100,
              }}
            >
              {/* Profile Card Header */}
              <div style={{ paddingBottom: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>{currentUser.name}</div>
                <div style={{ fontSize: "11px", color: "#8E909B", marginBottom: "6px" }}>{currentUser.email}</div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.04em",
                      backgroundColor: roleDef.badgeBg,
                      color: roleDef.badgeText,
                      border: `1px solid ${roleDef.badgeBorder}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {roleDef.shortLabel}
                  </span>
                  <span style={{ fontSize: "11px", color: "#E1E4EA", fontWeight: 600 }}>
                    {roleDef.title}
                  </span>
                  <span style={{ fontSize: "10px", color: "#8E909B", fontFamily: "var(--font-mono)" }}>
                    {currentUser.department}
                  </span>
                </div>
              </div>

              {/* Quick Persona Switcher */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "#8E909B", letterSpacing: "0.08em", marginBottom: "8px" }}>
                  Switch Active Persona
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                  {users.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    const r = ROLE_DEFINITIONS[u.role];
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUserById(u.id);
                          setUserDropdownOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "8px",
                          backgroundColor: isSelected ? "rgba(255, 255, 255, 0.08)" : "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              backgroundColor: u.avatarColor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#FFFFFF",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            {u.initials}
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: isSelected ? 700 : 500, color: "#FFFFFF" }}>
                              {u.name}
                            </div>
                            <div style={{ fontSize: "9px", color: r?.badgeText || "#8E909B", fontFamily: "var(--font-mono)" }}>
                              {r?.shortLabel} • {r?.title}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#10B981" }}>
                            check
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Portal Link */}
              <div style={{ paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <Link
                  href="/users"
                  onClick={() => setUserDropdownOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 600,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>admin_panel_settings</span>
                  <span>Manage Users &amp; RBAC Portal →</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
