import { useEffect, useState } from "react";
import type { Alert } from "./types";
import { API_BASE, normalizeAlert } from "./api";

type AlertListener = (alert: Alert) => void;
export type FeedStatus = "connecting" | "live" | "reconnecting";
type StatusListener = (status: FeedStatus) => void;

// One WebSocket per tab, shared by every subscriber: the top bar and the page
// each opened their own, so every alert arrived twice over the network.
const alertListeners = new Set<AlertListener>();
const statusListeners = new Set<StatusListener>();
let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;
let status: FeedStatus = "connecting";

function setStatus(next: FeedStatus) {
  status = next;
  statusListeners.forEach((l) => l(next));
}

function connect() {
  if (typeof window === "undefined" || socket) return;
  const url = API_BASE.replace(/^http/, "ws") + "/ws/alerts";
  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  socket.onopen = () => {
    attempts = 0;
    setStatus("live");
  };
  socket.onmessage = (event) => {
    try {
      const alert = normalizeAlert(JSON.parse(event.data) as Alert);
      alertListeners.forEach((l) => l(alert));
    } catch {
      // a malformed frame is dropped, the feed carries on
    }
  };
  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };
  socket.onerror = () => socket?.close();
}

// 1 s, 2 s, 4 s ... up to 30 s, so an API that is down is not hammered every 4 s
function scheduleReconnect() {
  if (alertListeners.size === 0 || retry) return;
  setStatus("reconnecting");
  const delay = Math.min(30000, 1000 * 2 ** attempts++);
  retry = setTimeout(() => {
    retry = null;
    connect();
  }, delay);
}

function release() {
  if (alertListeners.size > 0) return;
  if (retry) clearTimeout(retry);
  retry = null;
  attempts = 0;
  const s = socket;
  socket = null;
  s?.close();
  setStatus("connecting");
}

/** Subscribes to the live alert feed. Returns an unsubscribe function. */
export function subscribeToAlerts(onAlert: AlertListener): () => void {
  alertListeners.add(onAlert);
  connect();
  return () => {
    alertListeners.delete(onAlert);
    release();
  };
}

/** Whether the live feed is connected, for a "live" / "reconnecting" indicator. */
export function useFeedStatus(): FeedStatus {
  const [current, setCurrent] = useState<FeedStatus>(status);
  useEffect(() => {
    statusListeners.add(setCurrent);
    setCurrent(status);
    return () => {
      statusListeners.delete(setCurrent);
    };
  }, []);
  return current;
}
