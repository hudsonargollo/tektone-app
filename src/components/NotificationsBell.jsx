import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Package, MessageSquare, PartyPopper } from "lucide-react";
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

// Self-contained: polls its own state so the 60s refresh never re-renders the board.
export default function NotificationsBell({ authed, avatarByName, onOpenCard, refreshSignal }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);

  const refetch = useCallback(() => {
    if (!authed) return;
    api
      .getNotifications()
      .then(({ notifications, total }) => {
        setNotifications(notifications || []);
        setTotal(total || 0);
      })
      .catch(() => {});
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    refetch();
    const t = setInterval(refetch, 60000);
    return () => clearInterval(t);
  }, [authed, refetch]);

  // Re-fetch when the parent signals a change (e.g. a comment was added/seen).
  useEffect(() => {
    if (refreshSignal !== undefined) refetch();
  }, [refreshSignal, refetch]);

  const markAll = () => {
    Promise.all(notifications.map((n) => api.markCardSeen(n.cardId)))
      .then(refetch)
      .catch(() => {});
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
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[9px] font-bold text-clay">
            {total > 9 ? "9+" : total}
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
                {notifications.length > 0 && (
                  <button
                    onClick={markAll}
                    className="font-mono text-[10px] text-stone-500 transition-colors hover:text-action"
                  >
                    marcar todas
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[11px] text-stone-400">
                  nenhuma novidade
                </div>
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.cardId}>
                      <button
                        onClick={() => {
                          onOpenCard(n.cardId);
                          setOpen(false);
                        }}
                        className="flex w-full items-start gap-2.5 border-b border-ink/[0.06] px-4 py-3 text-left transition-colors hover:bg-ink/[0.04]"
                      >
                        <Avatar
                          name={n.last.authorName}
                          src={avatarByName?.[n.last.authorName?.trim().toLowerCase()]}
                          size="md"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            {n.last.kind === "request" ? (
                              <Package size={11} className="shrink-0 text-warning" />
                            ) : n.last.kind === "reviewed" ? (
                              <PartyPopper size={11} className="shrink-0 text-success" />
                            ) : (
                              <MessageSquare size={11} className="shrink-0 text-stone-400" />
                            )}
                            <span className="truncate text-[13px] font-semibold text-ink">
                              {n.cardTitle}
                            </span>
                            {n.mentioned && (
                              <span className="shrink-0 rounded bg-action px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider text-clay">
                                @ você
                              </span>
                            )}
                            {n.mine && !n.mentioned && (
                              <span className="shrink-0 rounded bg-action/15 px-1 py-px font-mono text-[8px] uppercase tracking-wider text-action">
                                sua
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-stone-500">
                            <span className="font-medium text-stone-600">
                              {n.last.authorName?.split(" ")[0]}:
                            </span>{" "}
                            {n.last.text}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-stone-400">
                          {n.count > 1 && (
                            <span className="mr-1 rounded-full bg-action/15 px-1 text-action">
                              {n.count}
                            </span>
                          )}
                          {relTime(n.last.createdAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
