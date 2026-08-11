"use client";

/**
 * Shared front-door login (plan Phase 8) — the one entry point for every
 * Tektone account (staff, admin, or customer). Talks to the same compiled
 * auth backend every path-mounted product shares (/hub, /portal, /crm all
 * delegate to it — see tektone-app's worker/hub-entry.js and siblings), so
 * it doesn't matter which of those three paths this page's fetch calls hit;
 * /hub/api/auth/* is just the one picked. Session cookie is Path=/, so
 * logging in here authenticates all three products at once.
 *
 * After a successful login/signup, redirect by access_role:
 *   CUSTOMER      -> /portal
 *   STAFF / ADMIN -> /hub
 */
import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, ArrowLeft, ShieldQuestion, UserPlus } from "lucide-react";
import Logo from "@/components/Logo";
import GoldenRibbons from "@/components/GoldenRibbons";

const AUTH_BASE = "/hub/api/auth";
const ADMIN_CONTACT = "hudson@tektone.com.br";
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fieldCls =
  "w-full rounded-lg border border-ink/15 bg-ink/[0.03] py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-green";

type Step = "email" | "signup" | "login" | "forgot";

async function api(path: string, body?: unknown) {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error("api error"), { body: data });
  return data;
}

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetTo(s: Step) {
    setStep(s);
    setError("");
    setPassword("");
    setConfirm("");
  }

  async function redirectByRole() {
    const me = await api("/me");
    window.location.href = me.accessRole === "CUSTOMER" ? "/portal" : "/hub";
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setLoading(true);
    setError("");
    try {
      const { allowed, exists } = await api("/check", { email: addr });
      if (!allowed) setError("Este e-mail não tem acesso.");
      else resetTo(exists ? "login" : "signup");
    } catch {
      setError("Não foi possível verificar o e-mail.");
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      await api("/login", { email: email.trim(), password });
      await redirectByRole();
    } catch (err) {
      const body = (err as { body?: { error?: string } }).body;
      setError(body?.error || "Senha incorreta.");
      setLoading(false);
    }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    setError("");
    try {
      await api("/signup", { email: email.trim(), password });
      await redirectByRole();
    } catch (err) {
      const body = (err as { body?: { error?: string } }).body;
      setError(body?.error || "Falha ao criar a conta.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ivory px-6">
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <div className="absolute inset-0 bp-dots opacity-40" aria-hidden />

      {/* The tekton — a master builder carving a Doric column — bleeding off
          the right edge, sepia-toned and heavily faded so it reads as
          texture/atmosphere behind the form, never competing with it. */}
      <div
        className="pointer-events-none absolute -right-[18%] top-1/2 h-[130%] w-[80%] -translate-y-1/2 opacity-[0.09] mix-blend-multiply sm:opacity-[0.12]"
        aria-hidden
      >
        <Image
          src="/tekton-illustration.png"
          alt=""
          fill
          sizes="80vw"
          className="object-contain object-right"
          style={{ filter: "sepia(0.4) saturate(0.65)" }}
          priority
        />
      </div>

      <GoldenRibbons className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-70" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-9 flex flex-col items-center text-center">
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)", opacity: 0 }}
            animate={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
            className="relative mb-3 h-16 w-14"
          >
            <Logo variant="ink" className="h-full w-full" />
            <span className="logo-shimmer" aria-hidden />
          </motion.div>
          <span className="text-lg font-semibold tracking-[0.32em] text-ink">TEKTONE</span>
          <p className="label-tech mt-1.5">acesso</p>
        </div>

        <div className="rounded-2xl surface-paper-raised p-7">
          <AnimatePresence mode="wait">
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
                  <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
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
                  <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
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
                  <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
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
                  <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
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
                  className="mt-4 w-full text-center font-mono text-[11px] tracking-wide text-ink/50 transition-colors hover:text-green"
                >
                  esqueci a senha
                </button>
              </motion.form>
            )}

            {step === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
              >
                <Head icon={ShieldQuestion} title="Redefinir senha" sub="reset assistido" />
                <p className="text-sm leading-relaxed text-ink/60">
                  Por segurança, a redefinição é feita pelo administrador. Peça ao admin para
                  resetar seu acesso — depois você poderá criar uma nova senha em{" "}
                  <span className="text-ink/80">primeiro acesso</span>.
                </p>
                <a
                  href={`mailto:${ADMIN_CONTACT}?subject=Reset%20de%20acesso%20-%20TEKTONE&body=Ol%C3%A1,%20preciso%20redefinir%20minha%20senha%20de%20acesso.`}
                  className="mt-4 flex items-center gap-2 rounded-lg surface-paper px-4 py-3 text-sm text-ink transition-colors hover:border-green/40"
                >
                  <Mail size={15} className="text-green" />
                  {ADMIN_CONTACT}
                </a>
                <button
                  type="button"
                  onClick={() => resetTo("login")}
                  className="mt-5 flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-ink/50 transition-colors hover:text-ink"
                >
                  <ArrowLeft size={12} /> voltar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function Head({ icon: Icon, title, sub }: { icon: typeof Mail; title: string; sub: string }) {
  return (
    <div className="mb-6 flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-paper text-green">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="font-mono text-[11px] text-ink/50">{sub}</p>
      </div>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
      {children}
    </label>
  );
}
function Err({ error }: { error: string }) {
  return error ? <p className="mt-3 font-mono text-[11px] text-danger">{error}</p> : null;
}
function Submit({ loading, disabled, children }: { loading: boolean; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-green px-5 py-3 text-sm font-bold text-ivory transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
function EmailRow({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2">
      <span className="truncate font-mono text-xs text-ink/70">{email}</span>
      <button type="button" onClick={onChange} className="shrink-0 font-mono text-[11px] text-green hover:underline">
        trocar
      </button>
    </div>
  );
}
function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-ivory/40 border-t-ivory" />;
}
