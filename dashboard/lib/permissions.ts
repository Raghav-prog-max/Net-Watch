"use client";

import { useCallback } from "react";
import { triage } from "./api";
import type { Alert } from "./types";
import { ROLE_DEFINITIONS } from "./users";
import { useUser } from "./userContext";

// The permission each triage outcome needs (ROLE_DEFINITIONS in lib/users.ts).
// Only the dashboard checks it: the API knows no users or roles, and roles live in
// this browser's storage. It decides what each role is offered here, not what the
// API accepts.
export const TRIAGE_PERMISSION: Record<Alert["status"], string> = {
  open: "triage_alerts",
  acknowledged: "triage_alerts",
  resolved: "triage_alerts",
  false_positive: "label_false_positives",
  escalated: "escalate_incidents",
};

const ACTION: Record<Alert["status"], string> = {
  open: "reopen alerts",
  acknowledged: "acknowledge alerts",
  resolved: "resolve alerts",
  false_positive: "mark false positives",
  escalated: "escalate incidents",
};

/** `can(status)`: may the signed-in role set it; `why(status)`: the reason it
 *  may not, for a disabled button's title; `triage`: lib/api.ts triage that
 *  refuses what the role may not do, so no caller can skip the check. */
export function useTriagePermission() {
  const { currentUser, hasPermission } = useUser();
  const can = useCallback(
    (status: Alert["status"]) => hasPermission(TRIAGE_PERMISSION[status]),
    [hasPermission],
  );
  const why = useCallback(
    (status: Alert["status"]) =>
      can(status)
        ? undefined
        : `The ${currentUser ? ROLE_DEFINITIONS[currentUser.role].title : "signed-out"} role can't ${ACTION[status]}`,
    [can, currentUser],
  );
  const guarded = useCallback(
    async (id: string, status: Alert["status"], analyst_label?: string, analyst_note?: string) => {
      const reason = why(status);
      if (reason) throw new Error(reason);
      return triage(id, status, analyst_label, analyst_note);
    },
    [why],
  );
  return { can, why, triage: guarded };
}
