import { useState, useRef, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/userContext";
import { listAlerts, triage } from "@/lib/api";
import { subscribeToAlerts, useFeedStatus } from "@/lib/socket";
import type { Alert } from "@/lib/types";
import { NotificationPanel, type NotificationItem } from "@/components/ui/notification-panel";

const NAV_ITEMS = [
  { label: "SOC Dashboard", href: "/dashboard", icon: "dashboard", desc: "Live intrusion detection overview" },
  { label: "All Alerts Feed", href: "/alerts", icon: "notifications_active", desc: "Browse, filter & triage flows" },
  { label: "ML Models & Registry", href: "/models", icon: "neurology", desc: "LightGBM & Isolation Forest v1" },
  { label: "Feature Drift Monitor", href: "/drift", icon: "monitoring", desc: "PSI & KS-test tracking" },
  { label: "Model Evaluation", href: "/evaluation", icon: "analytics", desc: "PR/ROC-AUC & LOFO tests" },
];

// The platform never changes while the page is open: nothing to subscribe to.
const noSubscription = () => () => {};

// ⌘K on macOS and iOS, Ctrl+K elsewhere
function platformShortcut(): string {
  const ua = (navigator.userAgent || navigator.platform || "").toLowerCase();
  return /macintosh|mac os x|iphone|ipad|ipod/.test(ua) ? "⌘K" : "Ctrl+K";
}

function formatAlertTime(isoStr: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr.slice(11, 19);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 15) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return isoStr.slice(11, 19);
  } catch {
    return isoStr.slice(11, 19);
  }
}

export default function SocTopBar() {
  const router = useRouter();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentUser, roster, switchAnalyst } = useUser();
  // the live feed's real state; this read NODE-ONLINE whatever happened
  const feedStatus = useFeedStatus();

  // Search input & command palette state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const shortcutLabel = useSyncExternalStore(noSubscription, platformShortcut, () => "⌘K");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setSearchFocused(true);
      } else if (e.key === "Escape") {
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);



  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch initial alerts and subscribe to real-time WebSocket alerts
  useEffect(() => {
    listAlerts({ limit: "15" })
      .then((items) => {
        if (items.length > 0) {
          setRecentAlerts(items);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeToAlerts((incomingAlert) => {
      setRecentAlerts((prev) => [incomingAlert, ...prev.filter((a) => a.id !== incomingAlert.id)].slice(0, 25));
    });

    return () => unsubscribe();
  }, []);

  // Map API Alerts into NotificationPanel items format
  const notificationItems = useMemo<NotificationItem[]>(() => {
    return recentAlerts.map((alert) => {
      const isCritical = alert.severity.level === "Critical";
      const isHigh = alert.severity.level === "High";
      const isNovel = alert.is_novel;

      let kind: NotificationItem["kind"] = "file";
      if (isCritical) kind = "request";
      else if (isNovel) kind = "created";
      else if (isHigh) kind = "edit";

      // only what the alert carries: CICIDS2017 has IPs and protocol, the
      // synthetic data has neither, so a missing fact reads "—", never a guess
      const src = alert.flow?.src_ip ?? "—";
      const dstPort = alert.flow?.dst_port ?? "—";
      const protocol = alert.flow?.protocol;

      return {
        id: alert.id,
        actor: {
          name: isNovel ? "Zero-Day Detector" : alert.prediction.family,
        },
        kind,
        body: [
          isNovel ? "detected zero-day anomaly " : "flagged network intrusion ",
          { entity: alert.prediction.family },
          ` (${alert.severity.level} severity - score ${alert.severity.score.toFixed(1)})`,
        ],
        time: formatAlertTime(alert.timestamp),
        context: [
          `${src} → :${dstPort}${protocol ? ` (${protocol})` : ""}`,
          isNovel ? "Novel Vector" : alert.mitre?.tactic ?? "—",
        ],
        unread: !readIds.has(alert.id),
        archived: archivedIds.has(alert.id),
        following: isCritical,
        count: alert.flow_count > 1 ? alert.flow_count : undefined,
        actions: [
          { id: "inspect", label: "Inspect", tone: "primary", resolved: "Inspecting threat" },
          { id: "ack", label: "Acknowledge", tone: "quiet", resolved: "Acknowledged alert" },
        ],
      };
    });
  }, [recentAlerts, readIds, archivedIds]);

  const hasUnread = notificationItems.some((n) => n.unread && !n.archived);

  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return NAV_ITEMS;
    const q = searchQuery.toLowerCase();
    return NAV_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredThreats = useMemo(() => {
    if (!searchQuery.trim()) return recentAlerts.slice(0, 4);
    const q = searchQuery.toLowerCase();
    // every field as text: the port is a number, and .includes() on it crashed the page
    const fields = (a: Alert) => [a.prediction.family, a.flow?.src_ip, a.flow?.dst_ip,
      a.flow?.dst_port, a.flow?.protocol, a.severity.level, a.mitre?.tactic];
    return recentAlerts.filter((a) =>
      fields(a).some((f) => f != null && String(f).toLowerCase().includes(q))
    ).slice(0, 5);
  }, [searchQuery, recentAlerts]);


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
            Hello, {currentUser?.name || "Analyst"}
          </h1>
          <span style={{ fontSize: "12px", color: "#8E909B" }}>•</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#8E909B" }}>{feedStatus === "live" ? "FEED LIVE" : feedStatus === "reconnecting" ? "FEED RECONNECTING" : "FEED CONNECTING"}</span>
        </div>
        <p style={{ margin: 0, fontSize: "11px", color: "#8E909B" }}>
          Real-time network intrusion monitoring &amp; automated triage
        </p>
      </div>

      {/* ── RIGHT: SEARCH, NOTIFICATIONS, AVATAR ──── */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search Input & Command Palette */}
        <div ref={searchContainerRef} style={{ position: "relative", width: "320px" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "12px", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "17px", color: searchFocused ? "#FFFFFF" : "#656773" }}>search</span>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                setSearchFocused(false);
                router.push("/alerts");
              } else if (e.key === "Escape") {
                setSearchFocused(false);
                searchInputRef.current?.blur();
              }
            }}
            placeholder="Search threats, IPs, tags..."
            style={{
              width: "100%",
              paddingLeft: "36px",
              paddingRight: shortcutLabel.length > 3 ? "68px" : "56px",
              paddingTop: "6px",
              paddingBottom: "6px",
              borderRadius: "9999px",
              backgroundColor: searchFocused ? "#141418" : "#0E0E12",
              border: searchFocused ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid rgba(255, 255, 255, 0.1)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#FFFFFF",
              outline: "none",
              transition: "all 0.15s ease",
              boxShadow: searchFocused ? "0 0 16px rgba(255, 255, 255, 0.08)" : "none",
            }}
          />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: "8px", display: "flex", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => {
                searchInputRef.current?.focus();
                setSearchFocused(true);
              }}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
              }}
              title={`Press ${shortcutLabel} to search`}
              aria-label={`Shortcut ${shortcutLabel}`}
            >
              <kbd style={{
                padding: "2px 6px",
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                borderRadius: "4px",
                backgroundColor: searchFocused ? "rgba(255, 255, 255, 0.18)" : "#1A1A20",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: searchFocused ? "#FFFFFF" : "#8E909B",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}>{shortcutLabel}</kbd>
            </button>
          </div>

          {/* Search Palette Dropdown */}
          {searchFocused && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                width: "380px",
                backgroundColor: "#141418",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "16px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
                zIndex: 100,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Threat alerts matches */}
              {filteredThreats.length > 0 && (
                <div style={{ padding: "8px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <div style={{ padding: "4px 16px", fontSize: "10px", fontWeight: 700, color: "#8E909B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                    Threat Alerts ({filteredThreats.length})
                  </div>
                  {filteredThreats.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        setSearchFocused(false);
                        router.push(`/alerts/${alert.id}`);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 16px",
                        background: "transparent",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF" }}>{alert.prediction.family}</span>
                        {alert.is_novel && (
                          <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", backgroundColor: "#FFFFFF", color: "#000000", fontWeight: 700 }}>ZERO-DAY</span>
                        )}
                        <span style={{ fontSize: "10px", color: "#8E909B", fontFamily: "var(--font-mono)" }}>
                          {alert.flow?.src_ip ?? "—"}
                        </span>
                      </div>
                      <span style={{ fontSize: "10px", color: "#8E909B", fontFamily: "var(--font-mono)" }}>
                        {alert.severity.level}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Navigation links */}
              {filteredNav.length > 0 && (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ padding: "4px 16px", fontSize: "10px", fontWeight: 700, color: "#8E909B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                    Quick Navigation
                  </div>
                  {filteredNav.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        setSearchFocused(false);
                        router.push(item.href);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 16px",
                        background: "transparent",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#8E909B" }}>{item.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF" }}>{item.label}</div>
                        <div style={{ fontSize: "10px", color: "#8E909B" }}>{item.desc}</div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#656773" }}>chevron_right</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div
                style={{
                  padding: "8px 16px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  backgroundColor: "#0E0E12",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  color: "#656773",
                }}
              >
                <span>[Enter] to search feed</span>
                <span>[Esc] to close</span>
                <span>[{shortcutLabel}] to toggle</span>
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell with Dropdown */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotificationsOpen((prev) => !prev)}
            style={{
              position: "relative",
              padding: "8px",
              borderRadius: "50%",
              backgroundColor: notificationsOpen ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              color: notificationsOpen ? "#FFFFFF" : "#8E909B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!notificationsOpen) e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              if (!notificationsOpen) e.currentTarget.style.color = "#8E909B";
            }}
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>notifications</span>
            {hasUnread && (
              <span
                style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#FFFFFF",
                  boxShadow: "0 0 6px rgba(255, 255, 255, 0.8)",
                }}
              />
            )}
          </button>

          {/* 21st.dev / Layro NotificationPanel */}
          {notificationsOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: "440px",
                maxWidth: "calc(100vw - 32px)",
                zIndex: 100,
                boxShadow: "0 24px 64px rgba(0, 0, 0, 0.75)",
                borderRadius: "18px",
              }}
            >
              <NotificationPanel
                items={notificationItems}
                maxHeight={400}
                onOpenItem={(item) => {
                  setNotificationsOpen(false);
                  router.push(`/alerts/${item.id}`);
                }}
                onAction={(item, actionId) => {
                  if (actionId === "inspect") {
                    setNotificationsOpen(false);
                    router.push(`/alerts/${item.id}`);
                  } else if (actionId === "ack") {
                    triage(item.id, "acknowledged").catch(() => {});
                  }
                }}
                onMarkAllRead={() => {
                  setReadIds(new Set(recentAlerts.map((a) => a.id)));
                }}
                onReadChange={(item, unread) => {
                  setReadIds((prev) => {
                    const next = new Set(prev);
                    if (unread) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                }}
                onArchiveChange={(item, archived) => {
                  setArchivedIds((prev) => {
                    const next = new Set(prev);
                    if (archived) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  });
                }}
                onSettings={() => {
                  setNotificationsOpen(false);
                  router.push("/alerts");
                }}
              />
            </div>
          )}
        </div>

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
                  backgroundColor: currentUser?.avatarColor || "#3B82F6",
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
                {currentUser?.initials || "NW"}
              </div>
              <span style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: currentUser ? "#10B981" : "#6B7280",
                border: "2px solid #050508",
              }} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF", lineHeight: 1.2 }}>
                {currentUser?.name || "Analyst"}
              </div>
              <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "#8E909B" }}>
                {currentUser?.department || "SecOps Team"}
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
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>{currentUser?.name || "Analyst"}</div>
                <div style={{ fontSize: "11px", color: "#8E909B", marginBottom: "6px" }}>{currentUser?.email || "No session"}</div>
                <div style={{ fontSize: "11px", color: "#E1E4EA", fontWeight: 600 }}>
                  {currentUser?.department || "SecOps Team"}
                  {currentUser?.shift ? ` · ${currentUser.shift}` : ""}
                </div>
              </div>

              {/* Verified Session Info */}
              <div style={{ marginBottom: "12px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div style={{ fontSize: "9px", color: "#8E909B", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>
                  Session
                </div>
                <div style={{ fontSize: "11px", color: "#E1E4EA", fontWeight: 600 }}>
                  Seeded roster, no sign-in
                </div>
              </div>

              {/* Switch analyst: there is no sign-in page, the console opens as the last analyst chosen */}
              <div style={{ paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ fontSize: "9px", color: "#8E909B", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 2px 2px" }}>
                  Switch analyst
                </div>
                {roster.filter((u) => u.id !== currentUser.id).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      switchAnalyst(u.id);
                      setUserDropdownOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "8px",
                      backgroundColor: "transparent",
                      color: "#E1E4EA",
                      border: "none",
                      fontSize: "11px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: u.avatarColor, color: "#FFFFFF", fontSize: "9px", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {u.initials}
                    </span>
                    <span>{u.name}</span>
                    <span style={{ marginLeft: "auto", color: "#8E909B", fontSize: "10px" }}>{u.department}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
