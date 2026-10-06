import { useCallback, useEffect, useState } from "react";
import { countAlerts } from "./api";

/**
 * Alerts an analyst has marked false positive: the labels the next retraining
 * learns from (scripts/retrain.py), and the counter demo step 4 shows going up.
 * Polled, so a triage in another tab shows up too, and `refresh` is called
 * right after a triage here. It was fetched once per page load, so the counter
 * stood still while the analyst marked alerts. null until the API answers.
 */
export function useFalsePositiveCount(pollMs = 5000): [number | null, () => void] {
  const [count, setCount] = useState<number | null>(null);
  const refresh = useCallback(() => {
    countAlerts({ status: "false_positive" }).then(setCount).catch(() => setCount(null));
  }, []);
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [refresh, pollMs]);
  return [count, refresh];
}
