import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, ShieldCheck, RotateCcw, Check, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

export default function AdminPanel({ currentEmail, onClose }) {
  const [users, setUsers] = useState(null);
  const [busy, setBusy] = useState(null); // email being reset
  const [error, setError] = useState("");

  async function load() {
    try {
      const { users } = await api.adminUsers();
      setUsers(users);
    } catch (e) {
      setError(e.body?.error || "Falha ao carregar.");
    }
  }
  useEffect(() => {
    load();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function reset(email) {
    const self = email === currentEmail;
    const msg = self
      ? "Resetar SUA conta? Você será desconectado e precisará criar uma nova senha."
      : `Resetar o acesso de ${email}? A pessoa precisará criar uma nova senha no próximo acesso.`;
    if (!window.confirm(msg)) return;
    setBusy(email);
    try {
      await api.adminReset(email);
      await load();
      if (self) window.location.reload();
    } catch (e) {
      setError(e.body?.error || "Falha ao resetar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-action" />
            <span className="label-tech">Admin · acessos</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="mb-4 text-xs leading-relaxed text-stone-500">
            Resetar remove a senha da pessoa. No próximo acesso ela cria uma nova
            senha em “primeiro acesso”.
          </p>

          {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}

          {!users ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li
                  key={u.email}
                  className="flex items-center justify-between gap-3 rounded-lg surface-3 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                      {u.email}
                      {u.admin && (
                        <span className="rounded bg-action/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-action">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
                      {u.registered ? (
                        <>
                          <Check size={11} className="text-success" /> registrado
                        </>
                      ) : (
                        <>
                          <Clock size={11} className="text-warning" /> pendente
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    disabled={!u.registered || busy === u.email}
                    onClick={() => reset(u.email)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-600 transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {busy === u.email ? <Spinner /> : <RotateCcw size={12} />}
                    resetar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
