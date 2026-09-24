import type { Explanation } from "@/lib/types";

export default function ShapBar({ items }: { items: Explanation[] }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ color: "var(--nw-text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
        No explanation telemetry available.
      </div>
    );
  }

  const maxImpact = Math.max(...items.map((i) => Math.abs(i.impact)), 0.01);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.map((item) => {
        const absImpact = Math.abs(item.impact);
        const percent = Math.min(100, Math.max(6, (absImpact / maxImpact) * 100));
        const isPositive = item.impact >= 0;

        return (
          <div
            key={item.feature}
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              borderRadius: "14px",
              padding: "10px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontSize: "12px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--nw-text-primary)",
                }}
              >
                {item.feature}
              </span>
              <div style={{ display: "flex", gap: "12px", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                <span style={{ color: "var(--nw-text-muted)" }}>
                  val: {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                </span>
                <span
                  style={{
                    color: isPositive ? "var(--nw-card-1)" : "var(--nw-card-2)",
                    fontWeight: 700,
                  }}
                >
                  {isPositive ? "+" : ""}
                  {item.impact.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Impact Bar */}
            <div
              style={{
                height: "5px",
                width: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderRadius: "9999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${percent}%`,
                  backgroundColor: isPositive ? "var(--nw-card-1)" : "var(--nw-card-2)",
                  borderRadius: "9999px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
