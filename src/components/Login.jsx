import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const fieldCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-action";

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (isSignup && password.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isSignup) await api.signup(email.trim(), password);
      else await api.login(email.trim(), password);
      onAuthed();
    } catch (err) {
      setError(err.body?.error || "Falha na autenticação.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-base px-6">
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
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-3 text-action">
              <Lock size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {isSignup ? "Criar conta" : "Entrar"}
              </p>
              <p className="font-mono text-[11px] text-zinc-500">acesso restrito</p>
            </div>
          </div>

          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            E-mail
          </label>
          <div className="relative mb-4">
            <Mail
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@tektone.com.br"
              className={fieldCls}
            />
          </div>

          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Senha
          </label>
          <div className="relative">
            <Lock
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "mín. 8 caracteres" : "••••••••"}
              className={fieldCls}
            />
          </div>

          {error && <p className="mt-3 font-mono text-[11px] text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-action px-5 py-3 text-sm font-bold text-ink-base transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ring-action"
          >
            {loading ? (
              <Spinner />
            ) : (
              <>
                {isSignup ? "Criar conta" : "Entrar"}
                <ArrowRight size={15} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError("");
            }}
            className="mt-4 w-full text-center font-mono text-[11px] tracking-wide text-zinc-500 transition-colors hover:text-action"
          >
            {isSignup
              ? "já tem conta? entrar"
              : "primeiro acesso? criar conta"}
          </button>
        </form>

        <p className="mt-5 text-center font-mono text-[11px] text-zinc-700">
          tasks.tektone.com.br
        </p>
      </motion.div>
    </div>
  );
}
