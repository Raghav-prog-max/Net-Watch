"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";
import type { User } from "./types";
import { ROSTER } from "./users";

// Who is on shift: one analyst from the seeded roster. There is no sign-in page:
// the console opens as the last analyst chosen (or the first on the roster), and
// the top bar's menu switches. This names who triages; it protects nothing (the
// API's writes have their own key).
const STORAGE_KEY = "netwatch_analyst_id";

// this tab's choice, which still holds when storage is unavailable (private window)
let chosenId: string | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function savedId(): string | null {
  if (chosenId) return chosenId;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface UserContextType {
  currentUser: User;
  roster: User[];
  switchAnalyst: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function switchAnalyst(userId: string) {
  if (!ROSTER.some((u) => u.id === userId)) return;
  chosenId = userId;
  try {
    localStorage.setItem(STORAGE_KEY, userId);
  } catch {}
  listeners.forEach((l) => l());
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  // the server render has no storage: it shows the first analyst
  const id = useSyncExternalStore(subscribe, savedId, () => null);
  const currentUser = ROSTER.find((u) => u.id === id) ?? ROSTER[0];

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
