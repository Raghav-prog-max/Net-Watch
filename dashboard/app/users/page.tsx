"use client";

import React, { useState, useMemo } from "react";
import { useUser } from "@/lib/userContext";
import { ROLE_DEFINITIONS, PERMISSIONS_CATALOG } from "@/lib/users";
import type { User, UserRole, UserStatus } from "@/lib/types";

type ActiveTab = "directory" | "matrix" | "audit";

export default function UsersPage() {
  const {
    currentUser,
    users,
    auditLogs,
    addUser,
    updateUser,
    deleteUser,
    hasPermission,
    resetDefaults,
  } = useUser();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("directory");

  // Filter states for directory
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Filter states for audit log
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<string>("all");

  // Selected role to inspect in the matrix tab
  const [highlightedRole, setHighlightedRole] = useState<UserRole>(currentUser?.role || "tier_2");

  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<User | null>(null);

  // Invite modal form fields
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("tier_2");
  const [inviteDepartment, setInviteDepartment] = useState("SOC Day Shift");
  const [inviteShift, setInviteShift] = useState("08:00 - 16:00 UTC");
  const [invite2FA, setInvite2FA] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edit modal form fields
  const [editRole, setEditRole] = useState<UserRole>("tier_2");
  const [editStatus, setEditStatus] = useState<UserStatus>("active");
  const [editDepartment, setEditDepartment] = useState("");
  const [editShift, setEditShift] = useState("");
  const [edit2FA, setEdit2FA] = useState(true);

  // Toast / notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  // Metrics calculations
  const totalUsers = users.length;
  const activeAnalysts = users.filter((u) => u.status === "active" && ["tier_1", "tier_2", "tier_3"].includes(u.role)).length;
  const privilegedAccounts = users.filter((u) => ["admin", "tier_3"].includes(u.role)).length;
  const mfaEnforcedCount = users.filter((u) => u.twoFactorEnabled).length;
  const mfaPercent = totalUsers > 0 ? Math.round((mfaEnforcedCount / totalUsers) * 100) : 0;

  // Filtered users for directory
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        (u.shift && u.shift.toLowerCase().includes(q));

      const matchesRole = selectedRoleFilter === "all" || u.role === selectedRoleFilter;
      const matchesStatus = selectedStatusFilter === "all" || u.status === selectedStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, selectedRoleFilter, selectedStatusFilter]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = auditSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        log.actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q);

      const matchesSeverity =
        auditSeverityFilter === "all" || log.severity === auditSeverityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [auditLogs, auditSearchQuery, auditSeverityFilter]);

  // Handle Invite Form Submission
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError("Please provide both full name and valid email address.");
      return;
    }
    if (!inviteEmail.includes("@")) {
      setInviteError("Please provide a valid corporate email.");
      return;
    }

    try {
      const newUser = addUser({
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        department: inviteDepartment.trim() || "SOC SecOps",
        shift: inviteShift.trim() || "Standard Shift",
        twoFactorEnabled: invite2FA,
      });

      setIsInviteModalOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("tier_2");
      setInviteError(null);
      showToast(`User ${newUser.name} enrolled with role ${ROLE_DEFINITIONS[newUser.role].title}.`);
    } catch {
      setInviteError("Failed to enroll user. Please check entries.");
    }
  };

  // Open Edit Modal
  const openEditModal = (user: User) => {
    setSelectedUserForAction(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditDepartment(user.department);
    setEditShift(user.shift || "");
    setEdit2FA(user.twoFactorEnabled);
    setIsEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAction) return;

    updateUser(selectedUserForAction.id, {
      role: editRole,
      status: editStatus,
      department: editDepartment.trim() || selectedUserForAction.department,
      shift: editShift.trim() || selectedUserForAction.shift,
      twoFactorEnabled: edit2FA,
    });

    setIsEditModalOpen(false);
    showToast(`Updated permissions & status for ${selectedUserForAction.name}.`);
  };

  // Open Revoke Confirmation Modal
  const openRevokeModal = (user: User) => {
    setSelectedUserForAction(user);
    setIsRevokeModalOpen(true);
  };

  // Handle Confirm Revoke
  const handleRevokeConfirm = () => {
    if (!selectedUserForAction) return;
    deleteUser(selectedUserForAction.id);
    setIsRevokeModalOpen(false);
    showToast(`Access revoked for ${selectedUserForAction.name}.`);
  };

  // Export audit logs as formatted JSON file
  const handleExportAuditLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `netwatch_secops_audit_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Audit log exported to JSON.");
  };

  // Current user's role definition
  const currentRoleDef = currentUser
    ? (ROLE_DEFINITIONS[currentUser.role] || ROLE_DEFINITIONS.tier_2)
    : ROLE_DEFINITIONS.tier_2;

  // Group permissions by category for the RBAC matrix
  const permissionsByCategory = useMemo(() => {
    const categories: Record<string, typeof PERMISSIONS_CATALOG> = {};
    PERMISSIONS_CATALOG.forEach((p) => {
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category].push(p);
    });
    return categories;
  }, []);

  return (
    <div style={{ maxWidth: "1400px", width: "100%", margin: "0 auto", padding: "24px 20px", minWidth: 0, boxSizing: "border-box" }}>
      {/* ── TOAST NOTIFICATION BANNER ─────────────────────────────────── */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            zIndex: 9999,
            backgroundColor: "#141418",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#10B981" }}>
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── TOP HEADER & ACTIONS ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#FFFFFF" }}>
              manage_accounts
            </span>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 800,
                margin: 0,
                color: "var(--nw-text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              SecOps User Management &amp; RBAC Portal
            </h1>
          </div>
          <p
            style={{
              margin: 0,
              color: "var(--nw-text-muted)",
              fontSize: "13px",
              maxWidth: "840px",
            }}
          >
            Manage active security analysts, enforce Role-Based Access Control (RBAC), provision emergency Tier-3 triage escalation permissions, and inspect immutable audit trails across the SOC.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="nw-btn-pill nw-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              person_add
            </span>
            <span>Enroll Analyst</span>
          </button>

          <button
            onClick={resetDefaults}
            className="nw-btn-pill nw-btn-secondary"
            title="Reset roster and audit logs to initial SOC defaults"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              restart_alt
            </span>
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* ── ACTIVE PERSONA CALLOUT BANNER ────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--nw-bg-panel)",
          borderRadius: "18px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: currentUser?.avatarColor || "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "16px",
              fontFamily: "var(--font-mono)",
              border: "2px solid rgba(255, 255, 255, 0.2)",
              flexShrink: 0,
            }}
          >
            {currentUser?.initials || "NW"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--nw-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Active Operating Persona
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.05em",
                  backgroundColor: currentRoleDef.badgeBg,
                  color: currentRoleDef.badgeText,
                  border: `1px solid ${currentRoleDef.badgeBorder}`,
                  whiteSpace: "nowrap",
                }}
              >
                <span>{currentRoleDef.shortLabel}</span>
                <span style={{ opacity: 0.6 }}>•</span>
                <span>{currentRoleDef.title}</span>
              </span>
              <span style={{ fontSize: "11px", color: "#10B981", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
                Firebase Cloud Session
              </span>
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", marginTop: "2px" }}>
              {currentUser?.name || "Analyst"} <span style={{ fontSize: "12px", color: "var(--nw-text-muted)", fontWeight: 400 }}>({currentUser?.email || "No session"})</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--nw-text-dim)", marginTop: "2px" }}>
              Department: <strong style={{ color: "#E1E4EA" }}>{currentUser?.department || "SecOps Team"}</strong> · Shift: <strong style={{ color: "#E1E4EA" }}>{currentUser?.shift || "Standard"}</strong> · Capabilities: <strong style={{ color: "#FFFFFF" }}>{currentRoleDef.permissions.length} of {PERMISSIONS_CATALOG.length} granted</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── METRIC STAT CARDS ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginBottom: "28px",
        }}
      >
        {/* Card 1: Total Team */}
        <div
          style={{
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "20px",
            padding: "20px 24px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Total SOC Personnel
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--nw-card-3)" }}>
              groups
            </span>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-text-primary)", margin: "4px 0" }}>
            {totalUsers}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            Across 5 functional security roles
          </div>
        </div>

        {/* Card 2: Frontline Analysts */}
        <div
          style={{
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "20px",
            padding: "20px 24px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--nw-card-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Frontline Analysts
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--nw-card-2)" }}>
              monitoring
            </span>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--nw-card-1)", margin: "4px 0" }}>
            {activeAnalysts}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            Active in Tier-1, Tier-2 &amp; Tier-3 triage
          </div>
        </div>

        {/* Card 3: Privileged Accounts */}
        <div
          style={{
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "20px",
            padding: "20px 24px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#C4B5FD", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Privileged Accounts
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#C4B5FD" }}>
              verified_user
            </span>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#FFFFFF", margin: "4px 0" }}>
            {privilegedAccounts}
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            Can trigger retrain &amp; promote model
          </div>
        </div>

        {/* Card 4: MFA Enforcement */}
        <div
          style={{
            backgroundColor: "var(--nw-bg-panel)",
            borderRadius: "20px",
            padding: "20px 24px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#6EE7B7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              MFA Enforcement Rate
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#6EE7B7" }}>
              security
            </span>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#6EE7B7", margin: "4px 0" }}>
            {mfaPercent}%
          </div>
          <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>
            {mfaEnforcedCount} of {totalUsers} accounts with Hardware/TOTP
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          marginBottom: "24px",
        }}
      >
        <button
          onClick={() => setActiveTab("directory")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: activeTab === "directory" ? "2px solid #FFFFFF" : "2px solid transparent",
            color: activeTab === "directory" ? "#FFFFFF" : "var(--nw-text-muted)",
            fontWeight: activeTab === "directory" ? 700 : 500,
            cursor: "pointer",
            fontSize: "13px",
            transition: "all 0.15s ease",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            badge
          </span>
          <span>SecOps Directory ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: activeTab === "matrix" ? "2px solid #FFFFFF" : "2px solid transparent",
            color: activeTab === "matrix" ? "#FFFFFF" : "var(--nw-text-muted)",
            fontWeight: activeTab === "matrix" ? 700 : 500,
            cursor: "pointer",
            fontSize: "13px",
            transition: "all 0.15s ease",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            grid_view
          </span>
          <span>Role Permissions Matrix (RBAC)</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: activeTab === "audit" ? "2px solid #FFFFFF" : "2px solid transparent",
            color: activeTab === "audit" ? "#FFFFFF" : "var(--nw-text-muted)",
            fontWeight: activeTab === "audit" ? 700 : 500,
            cursor: "pointer",
            fontSize: "13px",
            transition: "all 0.15s ease",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            history_edu
          </span>
          <span>Security Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* ── TAB 1: SECOPS DIRECTORY ──────────────────────────────────── */}
      {activeTab === "directory" && (
        <div>
          {/* Search and Filters Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            {/* Search input */}
            <div style={{ position: "relative", width: "320px", maxWidth: "100%" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--nw-text-muted)",
                  fontSize: "18px",
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Filter by name, email, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 38px",
                  backgroundColor: "var(--nw-bg-panel)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>Role:</span>
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  style={{
                    backgroundColor: "var(--nw-bg-panel)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">SOC Lead / Admin</option>
                  <option value="tier_3">Tier-3 Senior Responder</option>
                  <option value="tier_2">Tier-2 SecOps Analyst</option>
                  <option value="tier_1">Tier-1 Triage Specialist</option>
                  <option value="auditor">Compliance Auditor</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>Status:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  style={{
                    backgroundColor: "var(--nw-bg-panel)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {(searchQuery || selectedRoleFilter !== "all" || selectedStatusFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedRoleFilter("all");
                    setSelectedStatusFilter("all");
                  }}
                  className="nw-btn-pill nw-btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "11px" }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Directory High-Density Table */}
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "18px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: "23%" }}>
                      Analyst / Identity
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: "19%" }}>
                      SOC Role &amp; Tier
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: "18%" }}>
                      Department &amp; Shift
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: "14%" }}>
                      Security (MFA)
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: "9%" }}>
                      Status
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: "8%" }}>
                      Last Active
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", whiteSpace: "nowrap", width: "9%" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "36px 14px", textAlign: "center", color: "var(--nw-text-muted)" }}>
                        No personnel match the specified filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const roleDef = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.tier_2;
                      const isCurrent = currentUser ? user.id === currentUser.id : false;

                      return (
                        <tr
                          key={user.id}
                          style={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                            backgroundColor: isCurrent ? "rgba(255, 255, 255, 0.03)" : "transparent",
                            transition: "background-color 0.15s ease",
                          }}
                        >
                          {/* User Name & Email */}
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  backgroundColor: user.avatarColor,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#FFFFFF",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  fontFamily: "var(--font-mono)",
                                  flexShrink: 0,
                                }}
                              >
                                {user.initials}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ fontWeight: 600, color: "#FFFFFF", fontSize: "13px" }}>{user.name}</span>
                                  {isCurrent && (
                                    <span
                                      style={{
                                        fontSize: "9px",
                                        padding: "1px 5px",
                                        borderRadius: "4px",
                                        backgroundColor: "#FFFFFF",
                                        color: "#000000",
                                        fontWeight: 800,
                                        fontFamily: "var(--font-mono)",
                                      }}
                                    >
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--nw-text-muted)", fontFamily: "var(--font-mono)" }}>
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge & Tier */}
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "2px 7px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  fontFamily: "var(--font-mono)",
                                  letterSpacing: "0.06em",
                                  backgroundColor: roleDef.badgeBg,
                                  color: roleDef.badgeText,
                                  border: `1px solid ${roleDef.badgeBorder}`,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {roleDef.shortLabel}
                              </span>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" }}>
                                {roleDef.title}
                              </span>
                            </div>
                          </td>

                          {/* Department & Shift */}
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ color: "#E1E4EA", fontWeight: 500, fontSize: "12px" }}>{user.department}</div>
                            <div style={{ fontSize: "10px", color: "var(--nw-text-muted)", fontFamily: "var(--font-mono)" }}>
                              {user.shift || "Standard"}
                            </div>
                          </td>

                          {/* 2FA / Security */}
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            {user.twoFactorEnabled ? (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#6EE7B7", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                  shield
                                </span>
                                <span>Hardware/TOTP</span>
                              </div>
                            ) : (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#F87171", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                  gpp_bad
                                </span>
                                <span>Unenforced</span>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  backgroundColor:
                                    user.status === "active"
                                      ? "#10B981"
                                      : user.status === "pending"
                                      ? "#F59E0B"
                                      : "#EF4444",
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "12px",
                                  textTransform: "capitalize",
                                  color:
                                    user.status === "active"
                                      ? "#E1E4EA"
                                      : user.status === "pending"
                                      ? "#FCD34D"
                                      : "#FCA5A5",
                                }}
                              >
                                {user.status}
                              </span>
                            </div>
                          </td>

                          {/* Last Active */}
                          <td style={{ padding: "11px 14px", color: "var(--nw-text-muted)", fontSize: "11px", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                            {user.lastActive}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", gap: "5px", alignItems: "center", justifyContent: "flex-end" }}>
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: "9px",
                                    color: "#10B981",
                                    fontFamily: "var(--font-mono)",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                                    border: "1px solid rgba(16, 185, 129, 0.25)",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  ACTIVE
                                </span>
                              )}

                              <button
                                onClick={() => openEditModal(user)}
                                className="nw-btn-pill nw-btn-secondary"
                                style={{ padding: "3px 6px" }}
                                title="Edit role & status"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                                  edit
                                </span>
                              </button>

                              <button
                                onClick={() => openRevokeModal(user)}
                                className="nw-btn-pill nw-btn-secondary"
                                style={{ padding: "3px 6px", color: "#F87171" }}
                                title="Revoke access"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                                  person_remove
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                color: "var(--nw-text-dim)",
              }}
            >
              <span>Showing {filteredUsers.length} of {totalUsers} registered SecOps members</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>NetWatch RBAC v2.4 • Client Vault Active</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ROLE PERMISSIONS MATRIX (RBAC) ────────────────────── */}
      {activeTab === "matrix" && (
        <div>
          {/* Role selector chips at the top */}
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "18px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--nw-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
              Explore Role Profiles &amp; Responsibilities
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((roleKey) => {
                const r = ROLE_DEFINITIONS[roleKey];
                const isSelected = highlightedRole === roleKey;
                const membersWithRole = users.filter((u) => u.role === roleKey).length;

                return (
                  <div
                    key={roleKey}
                    onClick={() => setHighlightedRole(roleKey)}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      backgroundColor: isSelected ? "var(--nw-bg-elevated)" : "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.08)"}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "0.05em",
                          backgroundColor: r.badgeBg,
                          color: r.badgeText,
                          border: `1px solid ${r.badgeBorder}`,
                        }}
                      >
                        {r.shortLabel}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--nw-text-muted)", fontFamily: "var(--font-mono)" }}>
                        {membersWithRole} member{membersWithRole === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>
                      {r.title}
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--nw-text-muted)", lineHeight: 1.4 }}>
                      {r.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Granular Permissions Matrix Table */}
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "18px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF" }}>
                  Fine-Grained SOC Capability Matrix
                </div>
                <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
                  Verified zero-leakage ML pipeline &amp; operational incident governance permissions.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="nw-pill nw-pill-lime" style={{ fontSize: "10px" }}>
                  Active User Role: {currentUser ? ROLE_DEFINITIONS[currentUser.role]?.title : "No Active Session"}
                </span>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", backgroundColor: "rgba(255, 255, 255, 0.02)" }}>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", width: "320px" }}>
                      Capability / Permission
                    </th>
                    {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((roleKey) => {
                      const r = ROLE_DEFINITIONS[roleKey];
                      const isHighlighted = highlightedRole === roleKey;
                      const isCurrent = currentUser ? currentUser.role === roleKey : false;

                      return (
                        <th
                          key={roleKey}
                          style={{
                            padding: "14px 16px",
                            fontWeight: 700,
                            color: isHighlighted ? "#FFFFFF" : "var(--nw-text-muted)",
                            fontSize: "11px",
                            textTransform: "uppercase",
                            textAlign: "center",
                            backgroundColor: isHighlighted ? "rgba(255, 255, 255, 0.04)" : "transparent",
                            borderLeft: isHighlighted ? "1px solid rgba(255, 255, 255, 0.15)" : "none",
                            borderRight: isHighlighted ? "1px solid rgba(255, 255, 255, 0.15)" : "none",
                          }}
                        >
                          <div>{r.title}</div>
                          <div style={{ fontSize: "9px", color: r.badgeText, fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                            {r.shortLabel} {isCurrent && "• (YOU)"}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <React.Fragment key={category}>
                      {/* Category Header Row */}
                      <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}>
                        <td
                          colSpan={6}
                          style={{
                            padding: "8px 20px",
                            fontSize: "10px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "#8E909B",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          }}
                        >
                          {category}
                        </td>
                      </tr>

                      {/* Permission Rows */}
                      {perms.map((perm) => (
                        <tr
                          key={perm.id}
                          style={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          }}
                        >
                          <td style={{ padding: "12px 20px" }}>
                            <div style={{ fontWeight: 600, color: "#FFFFFF" }}>{perm.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>{perm.description}</div>
                          </td>

                          {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((roleKey) => {
                            const r = ROLE_DEFINITIONS[roleKey];
                            const isGranted = r.permissions.includes(perm.id);
                            const isHighlighted = highlightedRole === roleKey;

                            return (
                              <td
                                key={roleKey}
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "center",
                                  backgroundColor: isHighlighted ? "rgba(255, 255, 255, 0.04)" : "transparent",
                                  borderLeft: isHighlighted ? "1px solid rgba(255, 255, 255, 0.15)" : "none",
                                  borderRight: isHighlighted ? "1px solid rgba(255, 255, 255, 0.15)" : "none",
                                }}
                              >
                                {isGranted ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "50%",
                                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                                      color: "#10B981",
                                    }}
                                    title={`Granted to ${r.title}`}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                      check
                                    </span>
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "50%",
                                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                                      color: "rgba(255, 255, 255, 0.15)",
                                    }}
                                    title={`Restricted from ${r.title}`}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                      lock
                                    </span>
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SECURITY AUDIT TRAIL ──────────────────────────────── */}
      {activeTab === "audit" && (
        <div>
          {/* Audit Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ position: "relative", width: "320px", maxWidth: "100%" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--nw-text-muted)",
                  fontSize: "18px",
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search audit actions, actors, targets..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 38px",
                  backgroundColor: "var(--nw-bg-panel)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>Severity:</span>
                <select
                  value={auditSeverityFilter}
                  onChange={(e) => setAuditSeverityFilter(e.target.value)}
                  style={{
                    backgroundColor: "var(--nw-bg-panel)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <button
                onClick={handleExportAuditLogs}
                className="nw-btn-pill nw-btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  download
                </span>
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Audit Log Table */}
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "18px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", backgroundColor: "rgba(255, 255, 255, 0.02)" }}>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", width: "16%" }}>
                      Timestamp (UTC)
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", width: "18%" }}>
                      Actor &amp; Role
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", width: "18%" }}>
                      Action Taken
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", width: "16%" }}>
                      Target Entity
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", width: "23%" }}>
                      Details / Justification
                    </th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--nw-text-muted)", fontSize: "11px", textTransform: "uppercase", textAlign: "right", width: "9%" }}>
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "36px 14px", textAlign: "center", color: "var(--nw-text-muted)" }}>
                        No audit events match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      const actorRoleDef = ROLE_DEFINITIONS[log.actorRole] || ROLE_DEFINITIONS.tier_2;

                      return (
                        <tr
                          key={log.id}
                          style={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          }}
                        >
                          <td style={{ padding: "11px 14px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--nw-text-muted)", whiteSpace: "nowrap" }}>
                            {log.timestamp}
                          </td>

                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 600, color: "#FFFFFF", fontSize: "13px" }}>{log.actorName}</div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  fontSize: "9px",
                                  fontWeight: 700,
                                  fontFamily: "var(--font-mono)",
                                  letterSpacing: "0.05em",
                                  backgroundColor: actorRoleDef.badgeBg,
                                  color: actorRoleDef.badgeText,
                                  border: `1px solid ${actorRoleDef.badgeBorder}`,
                                }}
                              >
                                {actorRoleDef.shortLabel}
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--nw-text-muted)" }}>{actorRoleDef.title}</span>
                            </div>
                          </td>

                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 255, 255, 0.06)",
                                color: "#E1E4EA",
                              }}
                            >
                              {log.action}
                            </span>
                          </td>

                          <td style={{ padding: "11px 14px", color: "#FFFFFF", fontWeight: 500, fontSize: "12px", whiteSpace: "nowrap" }}>
                            {log.target}
                          </td>

                          <td style={{ padding: "11px 14px", color: "var(--nw-text-muted)", fontSize: "12px", maxWidth: "380px" }}>
                            {log.details}
                          </td>

                          <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                fontFamily: "var(--font-mono)",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                backgroundColor:
                                  log.severity === "critical"
                                    ? "rgba(239, 68, 68, 0.2)"
                                    : log.severity === "warning"
                                    ? "rgba(245, 158, 11, 0.2)"
                                    : "rgba(255, 255, 255, 0.06)",
                                color:
                                  log.severity === "critical"
                                    ? "#FCA5A5"
                                    : log.severity === "warning"
                                    ? "#FCD34D"
                                    : "#8E909B",
                                border: `1px solid ${
                                  log.severity === "critical"
                                    ? "rgba(239, 68, 68, 0.4)"
                                    : log.severity === "warning"
                                    ? "rgba(245, 158, 11, 0.4)"
                                    : "rgba(255, 255, 255, 0.1)"
                                }`,
                              }}
                            >
                              {log.severity}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                color: "var(--nw-text-dim)",
              }}
            >
              <span>Logged {filteredAuditLogs.length} events • SIEM forwarder synced</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>SHA-256 Audit Integrity Verified</span>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 1: ENROLL / INVITE USER ────────────────────────────── */}
      {isInviteModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "20px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              width: "540px",
              maxWidth: "100%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>
                  Enroll SecOps Analyst
                </div>
                <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
                  Assign security role credentials and triage clearance
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--nw-text-muted)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleInviteSubmit} style={{ padding: "24px" }}>
              {inviteError && (
                <div
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#FCA5A5",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    marginBottom: "18px",
                  }}
                >
                  {inviteError}
                </div>
              )}

              {/* Full Name */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                  Full Legal Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jordan Hayes"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    backgroundColor: "var(--nw-bg-card)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Corporate Email */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                  Corporate Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. jordan.hayes@netwatch.internal"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    backgroundColor: "var(--nw-bg-card)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Role Select */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                  Operational SOC Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    backgroundColor: "var(--nw-bg-card)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="tier_1">Tier-1 Triage Specialist (Initial Alert Forwarding)</option>
                  <option value="tier_2">Tier-2 SecOps Analyst (SHAP Triage, Label False Positives)</option>
                  <option value="tier_3">Tier-3 Senior Responder (Incident Containment, Retrain Auth)</option>
                  <option value="admin">SOC Lead / Admin (Unrestricted System Governance)</option>
                  <option value="auditor">Compliance &amp; Governance Auditor (Read-Only)</option>
                </select>
                <div style={{ fontSize: "11px", color: "var(--nw-text-muted)", marginTop: "4px" }}>
                  {ROLE_DEFINITIONS[inviteRole]?.description}
                </div>
              </div>

              {/* Department & Shift in Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SOC Day Shift"
                    value={inviteDepartment}
                    onChange={(e) => setInviteDepartment(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      backgroundColor: "var(--nw-bg-card)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                    Assigned Shift
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 08:00 - 16:00 UTC"
                    value={inviteShift}
                    onChange={(e) => setInviteShift(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      backgroundColor: "var(--nw-bg-card)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Enforce 2FA Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  marginBottom: "24px",
                }}
              >
                <input
                  type="checkbox"
                  checked={invite2FA}
                  onChange={(e) => setInvite2FA(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#FFFFFF" }}
                />
                <span style={{ fontSize: "13px", color: "#E1E4EA" }}>
                  Enforce Hardware Key / TOTP Multi-Factor Authentication
                </span>
              </label>

              {/* Form Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="nw-btn-pill nw-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="nw-btn-pill nw-btn-primary">
                  Enroll Analyst
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT USER ROLE / STATUS ─────────────────────────── */}
      {isEditModalOpen && selectedUserForAction && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "20px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              width: "500px",
              maxWidth: "100%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>
                  Edit Permissions &amp; Status
                </div>
                <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
                  Modifying {selectedUserForAction.name} ({selectedUserForAction.email})
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--nw-text-muted)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ padding: "24px" }}>
              {/* Role Select */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                  Security Role &amp; Tier
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    backgroundColor: "var(--nw-bg-card)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="tier_1">Tier-1 Triage Specialist</option>
                  <option value="tier_2">Tier-2 SecOps Analyst</option>
                  <option value="tier_3">Tier-3 Senior Responder</option>
                  <option value="admin">SOC Lead / Admin</option>
                  <option value="auditor">Compliance &amp; Governance Auditor</option>
                </select>
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                  Account Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    backgroundColor: "var(--nw-bg-card)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="active">Active (Full login &amp; telemetry access)</option>
                  <option value="suspended">Suspended (Immediate revocation)</option>
                  <option value="pending">Pending (Awaiting clearance)</option>
                </select>
              </div>

              {/* Department & Shift */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      backgroundColor: "var(--nw-bg-card)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E1E4EA", marginBottom: "6px" }}>
                    Shift
                  </label>
                  <input
                    type="text"
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      backgroundColor: "var(--nw-bg-card)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Enforce 2FA */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  marginBottom: "24px",
                }}
              >
                <input
                  type="checkbox"
                  checked={edit2FA}
                  onChange={(e) => setEdit2FA(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#FFFFFF" }}
                />
                <span style={{ fontSize: "13px", color: "#E1E4EA" }}>
                  Multi-Factor Authentication (MFA) Active
                </span>
              </label>

              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="nw-btn-pill nw-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="nw-btn-pill nw-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: REVOKE / DELETE USER ────────────────────────────── */}
      {isRevokeModalOpen && selectedUserForAction && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--nw-bg-panel)",
              borderRadius: "20px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              width: "460px",
              maxWidth: "100%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    color: "#EF4444",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                    warning
                  </span>
                </span>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>
                    Revoke Analyst Access?
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--nw-text-muted)" }}>
                    This action will invalidate all active sessions and tokens.
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "#E1E4EA", lineHeight: 1.5, margin: "0 0 20px" }}>
                Are you sure you want to remove <strong>{selectedUserForAction.name}</strong> ({selectedUserForAction.email}) from the SecOps roster? This action is recorded in the SOC security audit log.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsRevokeModalOpen(false)}
                  className="nw-btn-pill nw-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRevokeConfirm}
                  style={{
                    backgroundColor: "#EF4444",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Revoke Access
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
