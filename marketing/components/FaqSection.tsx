"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import SectionBlob from "@/components/SectionBlob";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const faqs = [
  {
    q: "Como é possível entregar em 30 dias o que outros levam meses?",
    a: "Porque aceitamos no máximo 2-3 projetos por mês. Enquanto outras empresas dividem a atenção entre 15-20 projetos simultâneos, nós concentramos toda a nossa energia no seu. Além disso, nosso processo foi refinado para eliminar o desperdício de tempo que existe em software houses tradicionais: reuniões desnecessárias, retrabalho por falta de alinhamento e burocracia interna.",
  },
  {
    q: "E se eu não entender nada de tecnologia?",
    a: "Perfeito. A maioria dos nossos parceiros não entende. Você entra com a visão de negócio, nós cuidamos de toda a parte técnica. Nosso portal de acompanhamento foi criado justamente para que você saiba exatamente o que está acontecendo sem precisar entender uma linha de código.",
  },
  {
    q: "O que acontece depois dos 30 dias?",
    a: "Nosso relacionamento não termina na entrega. Continuamos como seus parceiros de negócio para ajudar a escalar o produto. Discutimos isso em detalhes durante nossa primeira conversa, porque cada projeto tem necessidades diferentes de suporte e evolução.",
  },
  {
    q: "Por que vocês aceitam tão poucos projetos?",
    a: "Porque os sócios trabalham pessoalmente em cada projeto. Se aceitássemos 10 ou 15 projetos por mês, seria impossível manter o nível de envolvimento e qualidade que prometemos. Preferimos fazer pouco e extraordinário do que muito e medíocre.",
  },
  {
    q: "E se minha ideia precisar de ajustes?",
    a: "Isso é parte do processo. Desde a primeira reunião, vamos te ajudar a refinar sua ideia com base em estratégia de mercado e viabilidade técnica. Muitos dos nossos melhores projetos nasceram de ideias iniciais que foram lapidadas juntos.",
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className="relative bg-ivory py-28 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-60 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="sand" className="-right-24 top-0 h-[26rem] w-[26rem]" />
      <div className="relative mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-12"
        >
          <p className="label-tech mb-4">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-display text-ink">
            Perguntas frequentes
          </h2>
          <p className="mt-2 text-ink/50">Talvez você esteja se perguntando...</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="rounded-2xl surface-paper-raised px-6 sm:px-8"
        >
          <Accordion defaultValue={[0]}>
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={i}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
