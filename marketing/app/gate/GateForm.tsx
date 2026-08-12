"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import GoldenRibbons from "@/components/GoldenRibbons";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function GateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      router.push(params.get("next") || "/");
      router.refresh();
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ivory px-6">
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <div className="absolute inset-0 bp-dots opacity-40" aria-hidden />
      <GoldenRibbons className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-70" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-9 flex flex-col items-center text-center">
          <div className="relative mb-3 h-16 w-14">
            <Logo variant="ink" className="h-full w-full" />
          </div>
          <span className="text-lg font-semibold tracking-[0.32em] text-ink">TEKTONE</span>
          <p className="label-tech mt-1.5">prévia em desenvolvimento</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl surface-paper-raised p-7">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-paper text-green">
              <Lock size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Página em construção</p>
              <p className="font-mono text-[11px] text-ink/50">informe a senha para continuar</p>
            </div>
          </div>

          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
            Senha
          </label>
          <div className="relative">
            <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              autoFocus
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-ink/15 bg-ink/[0.03] py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-green"
            />
          </div>
          {error && <p className="mt-3 font-mono text-[11px] text-danger">Senha incorreta.</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-green px-5 py-3 text-sm font-bold text-ivory transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ivory/40 border-t-ivory" />
            ) : (
              <>
                Entrar <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
