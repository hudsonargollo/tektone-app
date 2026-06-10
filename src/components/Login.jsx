import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

export default function Login({ onAuthed }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.login(password);
      onAuthed();
    } catch (err) {
      setError(err.body?.error || "Falha na autenticação.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-base px-6">
      {/* Blueprint backdrop */}
      <div className="absolute inset-0 bp-lines opacity-60" aria-hidden />
      <div className="absolute inset-0 bp-dots opacity-40" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-pillar opacity-30 blur-[140px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <span className="font-mono text-lg font-bold tracking-[0.3em] text-white">
            TEKTONE
          </span>
          <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-zinc-600">
            / OPERAÇÕES
          </p>
        </div>

        <form onSubmit={submit} className="rounded-2xl surface-2 p-7">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-3 text-action">
              <Lock size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Acesso restrito</p>
              <p className="font-mono text-[11px] text-zinc-500">pipeline interno</p>
            </div>
          </div>

          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Senha
          </label>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-action"
          />

          {error && (
            <p className="mt-3 font-mono text-[11px] text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-action px-5 py-3 text-sm font-bold text-ink-base transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ring-action"
          >
            {loading ? (
              <Spinner />
            ) : (
              <>
                Entrar
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center font-mono text-[11px] text-zinc-700">
          tasks.tektone.com.br
        </p>
      </motion.div>
    </div>
  );
}
