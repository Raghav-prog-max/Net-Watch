import type { Alert } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Subscribes to the live alert feed. Returns an unsubscribe function. */
export function subscribeToAlerts(onAlert: (alert: Alert) => void): () => void {
  const url = BASE.replace(/^http/, "ws") + "/ws/alerts";
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    socket = new WebSocket(url);
    socket.onmessage = (event) => onAlert(JSON.parse(event.data) as Alert);
    socket.onclose = () => {
      if (!closed) retry = setTimeout(connect, 2000); // the API restarts during development
    };
  };
  connect();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}
