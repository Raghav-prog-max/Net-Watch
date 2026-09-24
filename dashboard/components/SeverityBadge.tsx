import type { Level } from "@/lib/types";

export default function SeverityBadge({
  level,
  score,
  compact = false,
}: {
  level: Level;
  score?: number;
  compact?: boolean;
}) {
  const isCritical = level === "Critical";
  const isHigh = level === "High";
  const isMedium = level === "Medium";

  const pillClass = isCritical
    ? "nw-pill-amber"
    : isHigh
    ? "nw-pill-purple"
    : isMedium
    ? "nw-pill-lime"
    : "nw-pill-muted";

  const dotColor = isCritical
    ? "var(--nw-card-1)"
    : isHigh
    ? "var(--nw-card-2)"
    : isMedium
    ? "var(--nw-card-3)"
    : "var(--nw-text-muted)";

  return (
    <span
      className={`nw-pill ${pillClass}`}
      style={{
        padding: compact ? "2px 8px" : "4px 12px",
        fontSize: compact ? "10px" : "11px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: dotColor,
        }}
      />
      <span>{level.toUpperCase()}</span>
      {score !== undefined && (
        <span style={{ opacity: 0.8, fontFamily: "var(--font-mono)" }}>
          {score}
        </span>
      )}
    </span>
  );
}
