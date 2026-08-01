import { useEffect, useRef } from "react";

// Persistent WebSocket to the BoardRoom Durable Object (see
// functions/api/realtime/[[path]].js), reconnecting with backoff. The caller
// gets every parsed JSON event via onEvent — e.g. { type: "card:reviewed" }.
export function useRealtime(enabled, onEvent) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let ws;
    let closedByUs = false;
    let attempt = 0;
    let retryTimer;

    function connect() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${location.host}/api/realtime/connect`);
      ws.onopen = () => {
        attempt = 0;
      };
      ws.onmessage = (e) => {
        try {
          onEventRef.current?.(JSON.parse(e.data));
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
      ws?.close();
    };
  }, [enabled]);
}
