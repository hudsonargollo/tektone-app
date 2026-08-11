import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

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

      {/* Legal */}
      <div className="border-t border-ivory/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
          <p className="font-mono text-xs tracking-wide text-sand/40">
            © 2026 TEKTONE · Consultoria de Tecnologia &amp; Negócios
          </p>
          <p className="font-mono text-[11px] tracking-wide text-sand/25">
            built in the dark
          </p>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-6">
          <p className="text-center font-mono text-[11px] tracking-wide text-sand/25 sm:text-left">
            PSL Digital LTDA · CNPJ 49.037.198/0001-77
          </p>
        </div>
      </div>
    </footer>
  );
}
