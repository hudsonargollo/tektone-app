import { AnimatePresence, motion } from "framer-motion";
import { Vibrate } from "lucide-react";

export default function NudgeToast({ toasts, onOpen, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className="flex items-center gap-3 rounded-xl surface-2 px-4 py-3 shadow-xl"
          >
            <Vibrate size={16} className="shrink-0 text-action" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">{t.fromName} está te chamando</p>
              <p className="truncate text-xs text-stone-500">{t.cardTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpen(t.cardId);
                onDismiss(t.id);
              }}
              className="shrink-0 rounded-md bg-action px-2.5 py-1 text-[11px] font-bold text-clay transition-all hover:brightness-110"
            >
              abrir
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
