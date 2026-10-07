"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "./types";
import { ROSTER } from "./users";

// Who is on shift: one analyst from the seeded roster, chosen at sign-in and kept
// across reloads. There is no password: this names the analyst on the alerts they
// triage; it does not protect anything (the API's writes have their own key).
const STORAGE_KEY = "netwatch_analyst_id";

type Result = { success: boolean; error?: string };

export interface UserContextType {
  currentUser: User | null;
  roster: User[];
  isAuthenticated: boolean;
  authLoading: boolean;
  signIn: (userId: string) => Result;
  signInWithEmail: (email: string) => Result;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // restore the analyst chosen before the reload
  useEffect(() => {
    try {
      const id = localStorage.getItem(STORAGE_KEY);
      setCurrentUser(ROSTER.find((u) => u.id === id) ?? null);
    } catch {
      // storage unavailable (private window): start signed out
    }
    setAuthLoading(false);
  }, []);

  const signIn = (userId: string): Result => {
    const user = ROSTER.find((u) => u.id === userId);
    if (!user) return { success: false, error: "Pick an analyst from the roster." };
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEY, user.id);
    } catch {}
    return { success: true };
  };

  const signInWithEmail = (email: string): Result => {
    const user = ROSTER.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    return user ? signIn(user.id) : { success: false, error: "That email is not on the roster." };
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        roster: ROSTER,
        isAuthenticated: currentUser !== null,
        authLoading,
        signIn,
        signInWithEmail,
        logout,
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
