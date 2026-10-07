"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "./types";
import { ROSTER } from "./users";

// Who is on shift: one analyst from the seeded roster. There is no sign-in page:
// the console opens as the last analyst chosen (or the first on the roster), and
// the top bar's menu switches. This names who triages; it protects nothing (the
// API's writes have their own key).
const STORAGE_KEY = "netwatch_analyst_id";

export interface UserContextType {
  currentUser: User;
  roster: User[];
  switchAnalyst: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(ROSTER[0]);

  // the analyst chosen before the reload
  useEffect(() => {
    try {
      const saved = ROSTER.find((u) => u.id === localStorage.getItem(STORAGE_KEY));
      if (saved) setCurrentUser(saved);
    } catch {
      // storage unavailable (private window): stay on the first analyst
    }
  }, []);

  const switchAnalyst = (userId: string) => {
    const user = ROSTER.find((u) => u.id === userId);
    if (!user) return;
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEY, user.id);
    } catch {}
  };

  return (
    <UserContext.Provider value={{ currentUser, roster: ROSTER, switchAnalyst }}>
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
