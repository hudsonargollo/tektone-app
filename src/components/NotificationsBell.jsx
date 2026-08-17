import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Package, MessageSquare, PartyPopper, Undo2, Vibrate, UserPlus, Pencil, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui";

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const TYPE_META = {
  mention: { icon: MessageSquare, color: "text-stone-400", badge: "@ você" },
  request: { icon: Package, color: "text-warning", badge: null },
  assigned: { icon: UserPlus, color: "text-action", badge: "atribuído" },
  nudge: { icon: Vibrate, color: "text-action", badge: null },
  reviewed: { icon: PartyPopper, color: "text-success", badge: null },
  reopened: { icon: Undo2, color: "text-warning", badge: null },
  comment: { icon: MessageCircle, color: "text-stone-400", badge: "sua tarefa" },
  updated: { icon: Pencil, color: "text-stone-400", badge: "sua tarefa" },
};

// Self-contained: polls its own state so the 60s refresh never re-renders the board.
// Persistent log — items never disappear, only dim from unread → read on ack.
export default function NotificationsBell({ authed, avatarByName, onOpenCard, refreshSignal }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refetch = useCallback(() => {
    if (!authed) return;
    api
      .getNotifications()
      .then(({ items, unreadCount }) => {
        setItems(items || []);
        setUnreadCount(unreadCount || 0);
      })
      .catch(() => {});
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    refetch();
    const t = setInterval(refetch, 60000);
    return () => clearInterval(t);
  }, [authed, refetch]);

  // Re-fetch when the parent signals a change (e.g. a new realtime event).
  useEffect(() => {
    if (refreshSignal !== undefined) refetch();
  }, [refreshSignal, refetch]);

  const openItem = (n) => {
    onOpenCard(n.cardId);
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.ackNotifications([n.id]).catch(() => {});
    }
    setOpen(false);
  };

  const markAll = () => {
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    setUnreadCount(0);
    api.ackAllNotifications().catch(() => {});
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg border border-ink/15 p-1.5 text-stone-500 transition-colors hover:border-action/40 hover:text-action"
        title="Notificações"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[9px] font-bold text-clay">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl surface-2 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2.5">
                <span className="label-tech">Notificações</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAll}
                    className="font-mono text-[10px] text-stone-500 transition-colors hover:text-action"
                  >
                    marcar todas
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[11px] text-stone-400">
                  nenhuma novidade
                </div>
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {items.map((n) => {
                    const meta = TYPE_META[n.type] || TYPE_META.mention;
                    const Icon = meta.icon;
                    const unread = !n.readAt;
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => openItem(n)}
                          className={`relative flex w-full items-start gap-2.5 border-b border-ink/[0.06] px-4 py-3 text-left transition-colors hover:bg-ink/[0.04] ${
                            unread ? "bg-ink/[0.04]" : "opacity-55"
                          }`}
                        >
                          {unread && (
                            <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-action" aria-hidden />
                          )}
                          <Avatar
                            name={n.fromName}
                            src={avatarByName?.[n.fromName?.trim().toLowerCase()]}
                            size="md"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <Icon size={11} className={`shrink-0 ${meta.color}`} />
                              <span className="truncate text-[13px] font-semibold text-ink">
                                {n.cardTitle}
                              </span>
                              {meta.badge && (
                                <span className="shrink-0 rounded bg-action px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider text-clay">
                                  {meta.badge}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-stone-500">
                              <span className="font-medium text-stone-600">
                                {n.fromName?.split(" ")[0]}
                                {n.type === "nudge" ? " chamou você:" : ":"}
                              </span>{" "}
                              {n.text}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-stone-400">
                            {relTime(n.createdAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
