import type { Level } from "@/lib/types";

export default function SeverityBadge({ level, score }: { level: Level; score?: number }) {
  return (
    <span className={`badge ${level}`}>
      {level}
      {score !== undefined ? ` ${score}` : ""}
    </span>
  );
}
