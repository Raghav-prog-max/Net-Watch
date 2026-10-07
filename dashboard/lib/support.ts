import type { Support } from "./types";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** "524 of 600 flows · 95% interval 84.4%–89.8%": a rate on unseen attacks never
 *  shown without the flows it rests on. Empty for reports written before supports. */
export function supportText(s?: Support): string {
  if (!s?.interval_95) return "";
  const [lo, hi] = s.interval_95;
  return `${s.hits.toLocaleString()} of ${s.of.toLocaleString()} flows · 95% interval ${pct(lo)}–${pct(hi)}`;
}
