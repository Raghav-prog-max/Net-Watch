"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import SeverityBadge from "@/components/SeverityBadge";
import { listAlerts } from "@/lib/api";
import { subscribeToAlerts } from "@/lib/socket";
import type { Alert, Level } from "@/lib/types";

const LEVELS: (Level | "All")[] = ["All", "Critical", "High", "Medium", "Low"];

export default function LiveAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level, setLevel] = useState<Level | "All">("All");
  const [novelOnly, setNovelOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAlerts({ limit: "200" })
      .then(setAlerts)
      .catch(() => setError("Cannot reach the API. Start it with `make api`."));
    return subscribeToAlerts((alert) => setAlerts((prev) => [alert, ...prev].slice(0, 300)));
  }, []);

  const shown = useMemo(
    () =>
      alerts.filter(
        (a) => (level === "All" || a.severity.level === level) && (!novelOnly || a.is_novel),
      ),
    [alerts, level, novelOnly],
  );

  const counts = useMemo(() => {
    const byFamily = new Map<string, number>();
    alerts.forEach((a) => byFamily.set(a.prediction.family, (byFamily.get(a.prediction.family) ?? 0) + 1));
    return [...byFamily.entries()].sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  return (
    <>
      <h1>Live alerts</h1>
      <p className="lede">
        Sorted by severity. Nothing here is blocked automatically — every row is a decision for you.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="row" style={{ marginBottom: 18 }}>
        <div className="panel stat">
          <b>{alerts.length}</b>
          <span>alerts this session</span>
        </div>
        <div className="panel stat">
          <b>{alerts.filter((a) => a.severity.level === "Critical").length}</b>
          <span>critical</span>
        </div>
        <div className="panel stat">
          <b>{alerts.filter((a) => a.is_novel).length}</b>
          <span>unknown / novel</span>
        </div>
        <div className="panel stat">
          <b>{counts[0]?.[0] ?? "—"}</b>
          <span>most common family</span>
        </div>
      </div>

      <div className="filters">
        {LEVELS.map((l) => (
          <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
        <button aria-pressed={novelOnly} onClick={() => setNovelOnly((v) => !v)}>
          Unknown only
        </button>
      </div>

      <div className="panel">
        {shown.length === 0 ? (
          <p className="empty">
            No alerts yet. Replay some traffic: <code>python replay/replayer.py --scenario known</code>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Family</th>
                <th>Why it fired</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id} className="clickable">
                  <td>
                    <Link href={`/alerts/${a.id}`}>
                      <SeverityBadge level={a.severity.level} score={a.severity.score} />
                    </Link>
                  </td>
                  <td>
                    <Link href={`/alerts/${a.id}`}>
                      {a.prediction.family}
                      {a.is_novel && <span className="badge novel" style={{ marginLeft: 8 }}>novel</span>}
                      {a.also_abnormal && !a.is_novel && (
                        <span className="badge novel" style={{ marginLeft: 8 }}>also abnormal</span>
                      )}
                    </Link>
                  </td>
                  <td style={{ color: "var(--muted)" }}>
                    {a.explanation[0]?.feature ?? "—"}
                  </td>
                  <td style={{ color: "var(--muted)" }}>{a.timestamp.slice(11, 19)}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
