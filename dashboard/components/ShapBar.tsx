import type { Explanation } from "@/lib/types";

/** Why this flow was flagged, strongest signal first. */
export default function ShapBar({ items }: { items: Explanation[] }) {
  const max = Math.max(...items.map((i) => Math.abs(i.impact)), 1);
  return (
    <div>
      {items.map((item) => (
        <div key={item.feature} style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>{item.feature}</span>
            <span style={{ color: "var(--muted)" }}>{item.value.toLocaleString()}</span>
          </div>
          <div
            className="bar"
            style={{ width: `${Math.max((Math.abs(item.impact) / max) * 100, 4)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
