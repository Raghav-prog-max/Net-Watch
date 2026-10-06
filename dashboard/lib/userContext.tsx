"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, UserRole, AuditLogEntry } from "./types";
import { INITIAL_USERS, INITIAL_AUDIT_LOGS, ROLE_DEFINITIONS, getInitials } from "./users";

interface UserContextType {
  currentUser: User;
  users: User[];
  auditLogs: AuditLogEntry[];
  setCurrentUser: (user: User) => void;
  switchUserById: (userId: string) => void;
  addUser: (data: {
    name: string;
    email: string;
    role: UserRole;
    department: string;
    twoFactorEnabled?: boolean;
    shift?: string;
  }) => User;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  hasPermission: (permissionId: string) => boolean;
  resetDefaults: () => void;
}

const STORAGE_KEY_ACTIVE_USER = "netwatch_active_user_id_v2";
const STORAGE_KEY_USERS = "netwatch_users_roster_v2";
const STORAGE_KEY_AUDIT = "netwatch_audit_logs_v2";

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUserState] = useState<User>(INITIAL_USERS[0]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const storedUsersRaw = localStorage.getItem(STORAGE_KEY_USERS);
      let loadedUsers = INITIAL_USERS;
      if (storedUsersRaw) {
        const parsed = JSON.parse(storedUsersRaw);
        // Only load if not legacy roster
        if (Array.isArray(parsed) && parsed.length > 0 && !parsed.some((u: User) => u.id === "usr_sarah")) {
          loadedUsers = parsed;
          setUsers(loadedUsers);
        } else {
          setUsers(INITIAL_USERS);
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_USERS));
        }
      }

      const storedUserId = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
      if (storedUserId && loadedUsers.some((u) => u.id === storedUserId)) {
        const found = loadedUsers.find((u) => u.id === storedUserId);
        if (found) setCurrentUserState(found);
      } else {
        // Default to Satveek Gupta (SOC Lead)
        const satveek = loadedUsers.find((u) => u.id === "usr_satveek") || loadedUsers[0];
        setCurrentUserState(satveek);
      }

      const storedAudit = localStorage.getItem(STORAGE_KEY_AUDIT);
      if (storedAudit) {
        const parsedAudit = JSON.parse(storedAudit);
        if (Array.isArray(parsedAudit)) setAuditLogs(parsedAudit);
      }
    } catch {
      // Ignore localStorage errors (e.g. Incognito / disabled)
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save changes to localStorage
  const saveUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(newUsers));
    } catch {}
  };

  const saveAuditLogs = (newLogs: AuditLogEntry[]) => {
    setAuditLogs(newLogs);
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(newLogs));
    } catch {}
  };

  const setCurrentUser = (user: User) => {
    setCurrentUserState(user);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER, user.id);
    } catch {}
  };

  const switchUserById = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const addUser = (data: {
    name: string;
    email: string;
    role: UserRole;
    department: string;
    twoFactorEnabled?: boolean;
    shift?: string;
  }): User => {
    const id = `usr_${Date.now()}`;
    const initials = getInitials(data.name);

    // Pick avatar color based on role
    const colors: Record<UserRole, string> = {
      admin: "#8B5FBF",
      tier_3: "#EF4444",
      tier_2: "#3B82F6",
      tier_1: "#10B981",
      auditor: "#F59E0B",
    };

    const newUser: User = {
      id,
      name: data.name,
      email: data.email,
      role: data.role,
      status: "active",
      department: data.department || "SecOps Team",
      twoFactorEnabled: data.twoFactorEnabled ?? true,
      avatarColor: colors[data.role] || "#3B82F6",
      initials,
      lastActive: "Just now",
      createdAt: new Date().toISOString().split("T")[0],
      shift: data.shift || "Day Shift",
      assignedAlertsCount: 0,
    };

    const updated = [newUser, ...users];
    saveUsers(updated);

    // Record audit event
    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "USER_INVITED",
      target: newUser.name,
      details: `Created new user ${newUser.name} with role ${ROLE_DEFINITIONS[newUser.role].title}.`,
      severity: "info",
    };
    saveAuditLogs([audit, ...auditLogs]);

    return newUser;
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    const target = users.find((u) => u.id === userId);
    const updated = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          ...updates,
          initials: updates.name ? getInitials(updates.name) : u.initials,
        };
      }
      return u;
    });

    saveUsers(updated);

    if (currentUser.id === userId) {
      setCurrentUserState((prev) => ({
        ...prev,
        ...updates,
        initials: updates.name ? getInitials(updates.name) : prev.initials,
      }));
    }

    if (target) {
      const details = updates.role && updates.role !== target.role
        ? `Role updated from ${ROLE_DEFINITIONS[target.role].title} to ${ROLE_DEFINITIONS[updates.role].title}.`
        : `User profile properties updated.`;

      const audit: AuditLogEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: updates.role ? "ROLE_MODIFIED" : "USER_UPDATED",
        target: target.name,
        details,
        severity: "info",
      };
      saveAuditLogs([audit, ...auditLogs]);
    }
  };

  const deleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    const updated = users.filter((u) => u.id !== userId);
    saveUsers(updated);

    // If current user is deleted, fallback to first available
    if (currentUser.id === userId && updated.length > 0) {
      setCurrentUser(updated[0]);
    }

    if (target) {
      const audit: AuditLogEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: "USER_REVOKED",
        target: target.name,
        details: `Access revoked and user account removed from SecOps directory.`,
        severity: "warning",
      };
      saveAuditLogs([audit, ...auditLogs]);
    }
  };

  const hasPermission = (permissionId: string): boolean => {
    const roleDef = ROLE_DEFINITIONS[currentUser.role];
    if (!roleDef) return false;
    return roleDef.permissions.includes(permissionId);
  };

  const resetDefaults = () => {
    saveUsers(INITIAL_USERS);
    saveAuditLogs(INITIAL_AUDIT_LOGS);
    setCurrentUser(INITIAL_USERS[0]);
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        auditLogs,
        setCurrentUser,
        switchUserById,
        addUser,
        updateUser,
        deleteUser,
        hasPermission,
        resetDefaults,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
}
