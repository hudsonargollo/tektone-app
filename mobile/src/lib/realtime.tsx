// Realtime board events — port of web's src/lib/useRealtime.js + the
// onRealtimeEvent handling in App.jsx, adapted for a React Native WebSocket.
// Same broadcast-all/filter-client-side model as web: every event carries
// `recipients`/`to`, every connected client gets every event and checks
// locally "is this for me?" (see functions/api/kanban/[[path]].js).
//
// Auth: RN's WebSocket constructor supports a non-standard 3rd argument
// (`options.headers`) that lets us set Authorization on the handshake —
// functions/api/realtime/[[path]].js already accepts a bearer token there
// via getSessionEmail(), same as every other authenticated route.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getToken } from "./auth";
import { API_BASE } from "./api";

export type NudgeToastItem = { id: string; fromName: string; cardTitle: string; cardId: string };

type RealtimeCtxValue = {
  notifSignal: number;
  shake: boolean;
  toasts: NudgeToastItem[];
  dismissToast: (id: string) => void;
};

const RealtimeCtx = createContext<RealtimeCtxValue | null>(null);

export function RealtimeProvider({ children, myEmail }: { children: ReactNode; myEmail: string }) {
  const [notifSignal, setNotifSignal] = useState(0);
  const [shake, setShake] = useState(false);
  const [toasts, setToasts] = useState<NudgeToastItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  useEffect(() => {
    let closedByUs = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout>;

    function handleEvent(evt: any) {
      const me = myEmail.toLowerCase();
      const bump = () => setNotifSignal((s) => s + 1);

      if (evt.type === "card:reviewed") {
        bump();
      } else if (evt.type === "comment:mention" && evt.recipients?.map((e: string) => e.toLowerCase()).includes(me)) {
        bump();
      } else if (evt.type === "card:assigned" && evt.recipients?.map((e: string) => e.toLowerCase()).includes(me)) {
        bump();
      } else if (evt.type === "card:reopened" && evt.recipients?.map((e: string) => e.toLowerCase()).includes(me)) {
        bump();
      } else if (evt.type === "nudge" && String(evt.to || "").toLowerCase() === me) {
        bump();
        setShake(true);
        setTimeout(() => setShake(false), 600);
        const toast: NudgeToastItem = { id: evt.id, fromName: evt.fromName, cardTitle: evt.cardTitle, cardId: evt.cardId };
        setToasts((t) => [...t, toast]);
        setTimeout(() => dismissToast(toast.id), 6000);
      }
    }

    async function connect() {
      const token = await getToken();
      const wsUrl = `${API_BASE.replace(/^http/, "ws")}/api/realtime/connect`;
      // @ts-expect-error — RN's WebSocket accepts a 3rd `options` arg (headers), not in the lib.dom typings
      const ws = new WebSocket(wsUrl, [], { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
      };
      ws.onmessage = (e) => {
        try {
          handleEvent(JSON.parse(e.data));
        } catch {
          /* ignore malformed payloads */
        }
      };
      ws.onclose = () => {
        if (closedByUs) return;
        const delay = Math.min(30000, 1000 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [myEmail]);

  return (
    <RealtimeCtx.Provider value={{ notifSignal, shake, toasts, dismissToast }}>{children}</RealtimeCtx.Provider>
  );
}

export function useRealtimeContext() {
  const ctx = useContext(RealtimeCtx);
  if (!ctx) throw new Error("useRealtimeContext must be used within RealtimeProvider");
  return ctx;
}
