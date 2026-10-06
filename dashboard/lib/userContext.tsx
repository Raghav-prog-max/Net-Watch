"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, UserRole, AuditLogEntry } from "./types";
import { INITIAL_USERS, INITIAL_AUDIT_LOGS, ROLE_DEFINITIONS, getInitials } from "./users";
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
  isFirebaseConfigured,
  type FirebaseUser,
} from "./firebase";

export interface UserContextType {
  currentUser: User | null;
  users: User[];
  auditLogs: AuditLogEntry[];
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isFirebaseConfigured: boolean;
  authLoading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (name: string, email: string, pass: string, role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
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
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load roster and audit logs from localStorage on mount
  useEffect(() => {
    try {
      const storedUsersRaw = localStorage.getItem(STORAGE_KEY_USERS);
      if (storedUsersRaw) {
        const parsed = JSON.parse(storedUsersRaw);
        if (Array.isArray(parsed) && parsed.length > 0 && !parsed.some((u: User) => u.id === "usr_sarah")) {
          setUsers(parsed);
        } else {
          setUsers(INITIAL_USERS);
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_USERS));
        }
      }

      const storedAudit = localStorage.getItem(STORAGE_KEY_AUDIT);
      if (storedAudit) {
        const parsedAudit = JSON.parse(storedAudit);
        if (Array.isArray(parsedAudit)) setAuditLogs(parsedAudit);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Listen strictly to Firebase Auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        const email = fbUser.email.toLowerCase();
        setUsers((prevUsers) => {
          const match = prevUsers.find((u) => u.email.toLowerCase() === email);
          if (match) {
            setCurrentUserState(match);
            try {
              localStorage.setItem(STORAGE_KEY_ACTIVE_USER, match.id);
            } catch {}
            return prevUsers;
          } else {
            // Provision new analyst account for this authenticated Firebase user
            const name = fbUser.displayName || email.split("@")[0];
            const newUser: User = {
              id: `usr_${fbUser.uid.slice(0, 8)}`,
              name,
              email: fbUser.email || `${fbUser.uid}@netwatch.internal`,
              role: "tier_1",
              status: "active",
              department: "SecOps Operations",
              twoFactorEnabled: false,
              avatarColor: "#10B981",
              initials: getInitials(name),
              lastActive: "Just now",
              createdAt: new Date().toISOString().split("T")[0],
              shift: "Standard Shift",
              assignedAlertsCount: 0,
            };
            const updated = [newUser, ...prevUsers];
            try {
              localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updated));
              localStorage.setItem(STORAGE_KEY_ACTIVE_USER, newUser.id);
            } catch {}
            setCurrentUserState(newUser);
            return updated;
          }
        });
      } else {
        // No authenticated session in Firebase
        setCurrentUserState(null);
        try {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
        } catch {}
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
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

  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_USER, user.id);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
      }
    } catch {}
  };

  // Firebase email login (Real credentials only)
  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!isFirebaseConfigured || !auth) {
      return {
        success: false,
        error: "Firebase Authentication is not configured. Please verify your credentials in .env.local.",
      };
    }

    try {
      const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
      const userEmail = (userCred.user.email || "").toLowerCase();
      const match = users.find((u) => u.email.toLowerCase() === userEmail);
      if (match) {
        setCurrentUser(match);
      }
      return { success: true };
    } catch (err: any) {
      const code = err?.code || "";
      let msg = err?.message || "Failed to authenticate with Firebase.";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        msg = "Invalid email or password. Please verify your credentials.";
      } else if (code === "auth/too-many-requests") {
        msg = "Access temporarily disabled due to multiple failed login attempts.";
      }
      return { success: false, error: msg };
    }
  };

  // Firebase user registration with role assignment
  const registerWithEmail = async (
    name: string,
    email: string,
    pass: string,
    role: UserRole = "tier_1"
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!isFirebaseConfigured || !auth) {
      return {
        success: false,
        error: "Firebase Authentication is not configured. Please verify your credentials in .env.local.",
      };
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      if (name) {
        try {
          await updateProfile(userCred.user, { displayName: name });
        } catch {}
      }

      const created = addUser({
        name: name || trimmedEmail.split("@")[0],
        email: trimmedEmail,
        role,
        department: "SecOps Operations",
        shift: "Standard Shift",
      });
      setCurrentUser(created);
      return { success: true };
    } catch (err: any) {
      const code = err?.code || "";
      let msg = err?.message || "Registration failed.";
      if (code === "auth/email-already-in-use") {
        msg = "An account with this email already exists.";
      } else if (code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      }
      return { success: false, error: msg };
    }
  };

  // Firebase Google OAuth Sign In
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !auth) {
      return {
        success: false,
        error: "Firebase Authentication is not configured. Please verify your credentials in .env.local.",
      };
    }

    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const userEmail = (userCred.user.email || "").toLowerCase();
      const match = users.find((u) => u.email.toLowerCase() === userEmail);
      if (match) {
        setCurrentUser(match);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Google authentication failed." };
    }
  };

  // Logout from Firebase and active session
  const logout = async () => {
    if (auth && isFirebaseConfigured) {
      try {
        await signOut(auth);
      } catch {}
    }
    setFirebaseUser(null);
    setCurrentUserState(null);
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
    } catch {}
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

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      actorName: currentUser ? currentUser.name : "System Provisioner",
      actorRole: currentUser ? currentUser.role : "admin",
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

    if (currentUser && currentUser.id === userId) {
      setCurrentUserState((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
              initials: updates.name ? getInitials(updates.name) : prev.initials,
            }
          : null
      );
    }

    if (target) {
      const details = updates.role && updates.role !== target.role
        ? `Role updated from ${ROLE_DEFINITIONS[target.role].title} to ${ROLE_DEFINITIONS[updates.role].title}.`
        : `User profile properties updated.`;

      const audit: AuditLogEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        actorName: currentUser ? currentUser.name : "System",
        actorRole: currentUser ? currentUser.role : "admin",
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

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(null);
    }

    if (target) {
      const audit: AuditLogEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        actorName: currentUser ? currentUser.name : "System",
        actorRole: currentUser ? currentUser.role : "admin",
        action: "USER_REVOKED",
        target: target.name,
        details: `Access revoked and user account removed from SecOps directory.`,
        severity: "warning",
      };
      saveAuditLogs([audit, ...auditLogs]);
    }
  };

  const hasPermission = (permissionId: string): boolean => {
    if (!currentUser) return false;
    const roleDef = ROLE_DEFINITIONS[currentUser.role];
    if (!roleDef) return false;
    return roleDef.permissions.includes(permissionId);
  };

  const resetDefaults = () => {
    saveUsers(INITIAL_USERS);
    saveAuditLogs(INITIAL_AUDIT_LOGS);
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        auditLogs,
        firebaseUser,
        isAuthenticated: Boolean(firebaseUser && currentUser),
        isFirebaseConfigured,
        authLoading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        setCurrentUser,
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
