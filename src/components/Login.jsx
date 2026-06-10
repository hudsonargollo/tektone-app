import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, ArrowLeft, ShieldQuestion, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const ADMIN_CONTACT = "hudson@tektone.com.br";

const fieldCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-action";

// steps: "email" | "signup" | "login" | "forgot"
export default function Login({ onAuthed }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetTo(s) {
    setStep(s);
    setError("");
    setPassword("");
    setConfirm("");
  }

  async function submitEmail(e) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setLoading(true);
    setError("");
    try {
      const { allowed, exists } = await api.check(addr);
      if (!allowed) {
        setError("Este e-mail não tem acesso ao painel.");
      } else {
        resetTo(exists ? "login" : "signup");
      }
    } catch {
      setError("Não foi possível verificar o e-mail.");
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(e) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      await api.login(email.trim(), password);
      onAuthed();
    } catch (err) {
      setError(err.body?.error || "Senha incorreta.");
      setLoading(false);
    }
  }

  async function submitSignup(e) {
    e.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    setError("");
    try {
      await api.signup(email.trim(), password);
      onAuthed();
    } catch (err) {
      setError(err.body?.error || "Falha ao criar a conta.");
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

        <div className="rounded-2xl surface-2 p-7">
          <AnimatePresence mode="wait">
            {/* ── Email ─────────────────────────────────────────────── */}
            {step === "email" && (
              <motion.form
                key="email"
                onSubmit={submitEmail}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
              >
                <Head icon={Mail} title="Entrar" sub="informe seu e-mail" />
                <Label>E-mail</Label>
                <div className="relative">
                  <Mail size={14} className="input-ico" />
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
                <Err error={error} />
                <Submit loading={loading} disabled={!email.trim()}>
                  Continuar <ArrowRight size={15} />
                </Submit>
              </motion.form>
            )}

            {/* ── First access / signup ─────────────────────────────── */}
            {step === "signup" && (
              <motion.form
                key="signup"
                onSubmit={submitSignup}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
              >
                <Head icon={UserPlus} title="Primeiro acesso" sub="crie sua senha" />
                <EmailRow email={email} onChange={() => resetTo("email")} />
                <Label>Nova senha</Label>
                <div className="relative mb-4">
                  <Lock size={14} className="input-ico" />
                  <input
                    autoFocus
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="mín. 8 caracteres"
                    className={fieldCls}
                  />
                </div>
                <Label>Confirmar senha</Label>
                <div className="relative">
                  <Lock size={14} className="input-ico" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="repita a senha"
                    className={fieldCls}
                  />
                </div>
                <Err error={error} />
                <Submit loading={loading} disabled={!password || !confirm}>
                  Criar conta <ArrowRight size={15} />
                </Submit>
              </motion.form>
            )}

            {/* ── Returning / login ─────────────────────────────────── */}
            {step === "login" && (
              <motion.form
                key="login"
                onSubmit={submitLogin}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
              >
                <Head icon={Lock} title="Bem-vindo de volta" sub="informe sua senha" />
                <EmailRow email={email} onChange={() => resetTo("email")} />
                <Label>Senha</Label>
                <div className="relative">
                  <Lock size={14} className="input-ico" />
                  <input
                    autoFocus
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={fieldCls}
                  />
                </div>
                <Err error={error} />
                <Submit loading={loading} disabled={!password}>
                  Entrar <ArrowRight size={15} />
                </Submit>
                <button
                  type="button"
                  onClick={() => resetTo("forgot")}
                  className="mt-4 w-full text-center font-mono text-[11px] tracking-wide text-zinc-500 transition-colors hover:text-action"
                >
                  esqueci a senha
                </button>
              </motion.form>
            )}

            {/* ── Forgot (admin reset) ──────────────────────────────── */}
            {step === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
              >
                <Head icon={ShieldQuestion} title="Redefinir senha" sub="reset assistido" />
                <p className="text-sm leading-relaxed text-zinc-400">
                  Por segurança, a redefinição é feita pelo administrador. Peça ao
                  admin para resetar seu acesso — depois você poderá criar uma nova
                  senha em <span className="text-zinc-200">primeiro acesso</span>.
                </p>
                <a
                  href={`mailto:${ADMIN_CONTACT}?subject=Reset%20de%20acesso%20-%20TEKTONE%20Operações&body=Olá,%20preciso%20redefinir%20minha%20senha%20de%20acesso%20ao%20painel.`}
                  className="mt-4 flex items-center gap-2 rounded-lg surface-3 px-4 py-3 text-sm text-white transition-colors hover:border-action/40"
                >
                  <Mail size={15} className="text-action" />
                  {ADMIN_CONTACT}
                </a>
                <button
                  type="button"
                  onClick={() => resetTo("login")}
                  className="mt-5 flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-zinc-500 transition-colors hover:text-white"
                >
                  <ArrowLeft size={12} /> voltar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-5 text-center font-mono text-[11px] text-zinc-700">
          tasks.tektone.com.br
        </p>
      </motion.div>
    </div>
  );
}

// ── small presentational helpers ──────────────────────────────────────────────
function Head({ icon: Icon, title, sub }) {
  return (
    <div className="mb-6 flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-3 text-action">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="font-mono text-[11px] text-zinc-500">{sub}</p>
      </div>
    </div>
  );
}
function Label({ children }) {
  return (
    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
      {children}
    </label>
  );
}
function Err({ error }) {
  return error ? <p className="mt-3 font-mono text-[11px] text-danger">{error}</p> : null;
}
function Submit({ loading, disabled, children }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-action px-5 py-3 text-sm font-bold text-ink-base transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ring-action"
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
function EmailRow({ email, onChange }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="truncate font-mono text-xs text-zinc-300">{email}</span>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 font-mono text-[11px] text-action hover:underline"
      >
        trocar
      </button>
    </div>
  );
}
