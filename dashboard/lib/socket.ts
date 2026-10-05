import type { Alert } from "./types";
import { normalizeAlert } from "./api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";   // see lib/api.ts

type AlertListener = (alert: Alert) => void;

import { auth } from "./firebase";

export function subscribeToAlerts(onAlert: AlertListener): () => void {
  const url = BASE.replace(/^http/, "ws") + "/ws/alerts";
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = async () => {
    if (typeof window === "undefined") return;
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const authUrl = token ? `${url}?token=${token}` : url;

      socket = new WebSocket(authUrl);
      socket.onmessage = (event) => {
        try {
          const parsed = normalizeAlert(JSON.parse(event.data) as Alert);
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
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}
