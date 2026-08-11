import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AgitacaoSection from "@/components/AgitacaoSection";
import ProcessoSection from "@/components/ProcessoSection";
import ObjetivoSection from "@/components/ObjetivoSection";
import QualificacaoFitSection from "@/components/QualificacaoFitSection";
import AutoridadeSection from "@/components/AutoridadeSection";
import FaqSection from "@/components/FaqSection";
import HubTektoneSection from "@/components/HubTektoneSection";
import QualificacaoSection from "@/components/QualificacaoSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
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
        <QualificacaoSection />
      </main>
      <Footer />
    </>
  );
}
