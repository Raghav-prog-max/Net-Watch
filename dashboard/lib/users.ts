import type { User } from "./types";

// The seeded analysts. Signing in picks one of them: there is no password and no
// role, so this is who is on shift, not access control (the API checks its own key).
export const ROSTER: User[] = [
  {
    id: "usr_satveek",
    name: "Satveek Gupta",
    email: "satveek.gupta@netwatch.internal",
    department: "SecOps Leadership",
    avatarColor: "#8B5FBF",
    initials: "SG",
    shift: "Global Lead",
  },
  {
    id: "usr_raghav",
    name: "Raghav Sharma",
    email: "raghav.sharma@netwatch.internal",
    department: "Incident Response",
    avatarColor: "#EF4444",
    initials: "RS",
    shift: "On-Call Tier 3",
  },
  {
    id: "usr_mrigank",
    name: "Mrigank Bhatnagar",
    email: "mrigank.bhatnagar@netwatch.internal",
    department: "SOC Day Shift",
    avatarColor: "#3B82F6",
    initials: "MB",
    shift: "08:00 - 16:00 UTC",
  },
  {
    id: "usr_shivam",
    name: "Shivam Rai",
    email: "shivam.rai@netwatch.internal",
    department: "Threat Intelligence & Forensics",
    avatarColor: "#6366F1",
    initials: "SR",
    shift: "12:00 - 20:00 UTC",
  },
  {
    id: "usr_singhvrat",
    name: "Singhvrat Singh",
    email: "singhvrat.singh@netwatch.internal",
    department: "SOC Night Shift",
    avatarColor: "#10B981",
    initials: "SS",
    shift: "00:00 - 08:00 UTC",
  },
  {
    id: "usr_arnav",
    name: "Arnav Katyal",
    email: "arnav.katyal@netwatch.internal",
    department: "Risk & Governance",
    avatarColor: "#F59E0B",
    initials: "AK",
    shift: "Governance Shift",
  },
];

export function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
