import Navbar from "@/components/Navbar";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import HeroSection from "@/components/HeroSection";
import AgitacaoSection from "@/components/AgitacaoSection";
import ProcessoSection from "@/components/ProcessoSection";
import ObjetivoSection from "@/components/ObjetivoSection";
import QualificacaoFitSection from "@/components/QualificacaoFitSection";
import AutoridadeSection from "@/components/AutoridadeSection";
import FaqSection from "@/components/FaqSection";
import HubTektoneSection from "@/components/HubTektoneSection";
import Footer from "@/components/Footer";
import QualificacaoSectionV2 from "@/components/formv2/QualificacaoSectionV2";

// Clone of the production homepage (app/page.tsx) with one change: the
// qualification form is QualificacaoSectionV2 — every scene (cover, gate,
// each of the 9 questions, results) presented as a full-viewport parchment
// that rolls in/out, three.js ambience on capable devices. Everything above
// it (hero, nav, other sections) is untouched production code, so the
// hero's #qualificacao scroll-intercept and 3D departure animation keep
// working unchanged. Production `/` and the existing `/v2` redesign preview
// are both untouched by this page.
export default function FormV2() {
  return (
    <>
      <AnalyticsBeacon />
      <Navbar />
      <main>
        <HeroSection />
        <AgitacaoSection />
        <ProcessoSection />
        <ObjetivoSection />
        <QualificacaoFitSection />
        <AutoridadeSection />
        <FaqSection />
        <HubTektoneSection />
        <QualificacaoSectionV2 />
      </main>
      <Footer />
    </>
  );
}
