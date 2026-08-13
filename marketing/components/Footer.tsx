import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";

// lucide-react dropped brand/logo glyphs a while back, so these two are
// drawn by hand — plain currentColor strokes to stay monochrome and match
// the other footer icons' weight (h-3.5 w-3.5, stroke-width ~2).
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="7.5" cy="7.8" r="1.15" fill="currentColor" />
      <path d="M7.5 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M11.5 17v-3.6c0-1.3.9-2.2 2.1-2.2s2.1.9 2.1 2.2V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.5 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="relative bg-ink-950 border-t border-ivory/[0.08] overflow-hidden">
      <div className="absolute inset-0 grain-dark" aria-hidden />
      {/* Final CTA band */}
      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo variant="ivory" className="h-5 w-auto" />
              <span className="font-mono text-sm font-bold tracking-[0.28em] text-ivory">
                TEKTONE
              </span>
            </div>
            <p className="text-editorial mt-4 max-w-md text-pretty text-2xl sm:text-3xl leading-snug text-ivory">
              O futuro pertence a quem constrói hoje.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <a
              href="#qualificacao"
              className="group inline-flex items-center gap-2 rounded-lg border border-green-mist/30 bg-green-mist/10 px-6 py-3.5 text-sm font-bold text-green-mist transition-all duration-200 hover:bg-green-mist/20 hover:border-green-mist/50"
            >
              AGENDAR CALL DE QUALIFICAÇÃO
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <p className="font-mono text-xs tracking-wide text-sand/50">
              Leva menos de 3 minutos. Sem compromisso.
            </p>
          </div>
        </div>
      </div>

      {/* Company info + contact */}
      <div className="border-t border-ivory/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5 font-mono text-[11px] tracking-wide text-sand/40">
            <p className="text-sand/60">TEKTONE</p>
            <p>Razão Social: PSL DIGITAL LTDA</p>
            <p>CNPJ: 49.037.198/0001-77</p>
          </div>
          <div className="flex flex-col gap-2.5 font-mono text-[11px] tracking-wide text-sand/40">
            <a
              href="https://instagram.com/tektone.co"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition-colors hover:text-green-mist"
            >
              <InstagramIcon className="h-3.5 w-3.5" /> @Tektone.co
            </a>
            <a
              href="https://www.linkedin.com/company/tektoneco"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition-colors hover:text-green-mist"
            >
              <LinkedinIcon className="h-3.5 w-3.5" /> Tektone
            </a>
            <a
              href="mailto:Matrix@tektone.com.br"
              className="inline-flex items-center gap-2 transition-colors hover:text-green-mist"
            >
              <Mail className="h-3.5 w-3.5" /> Matrix@tektone.com.br
            </a>
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="border-t border-ivory/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
          <p className="font-mono text-xs tracking-wide text-sand/40">
            © 2026 TEKTONE · Consultoria de Tecnologia &amp; Negócios
          </p>
          <div className="flex items-center gap-4 font-mono text-[11px] tracking-wide text-sand/40">
            <Link href="/politica-de-privacidade" className="transition-colors hover:text-green-mist">
              Política de privacidade
            </Link>
            <span className="text-sand/20">·</span>
            <Link href="/termos-de-uso" className="transition-colors hover:text-green-mist">
              Termos de uso
            </Link>
          </div>
          <p className="font-mono text-[11px] tracking-wide text-sand/25">
            built in the dark
          </p>
        </div>
      </div>
    </footer>
  );
}
