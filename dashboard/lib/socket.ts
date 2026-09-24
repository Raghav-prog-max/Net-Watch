import type { Alert } from "./types";
import { addLocalAlert } from "./api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AlertListener = (alert: Alert) => void;
const internalListeners: Set<AlertListener> = new Set();

/** Trigger a simulated live alert broadcast across all subscribers */
export function broadcastSimulatedAlert(alert: Alert) {
  addLocalAlert(alert);
  internalListeners.forEach((fn) => {
    try {
      fn(alert);
    } catch (e) {
      console.error("Error in alert listener:", e);
    }
  });
}

/** Subscribes to the live alert feed. Returns an unsubscribe function. */
export function subscribeToAlerts(onAlert: AlertListener): () => void {
  internalListeners.add(onAlert);

  const url = BASE.replace(/^http/, "ws") + "/ws/alerts";
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    if (typeof window === "undefined") return;
    try {
      socket = new WebSocket(url);
      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as Alert;
          addLocalAlert(parsed);
          onAlert(parsed);
        } catch {
          // ignore malformed payloads
        }
      };
      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 4000);
      };
      socket.onerror = () => {
        socket?.close();
      };
    } catch {
      if (!closed) retry = setTimeout(connect, 4000);
    }
  };

  connect();

  return () => {
    closed = true;
    internalListeners.delete(onAlert);
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}
