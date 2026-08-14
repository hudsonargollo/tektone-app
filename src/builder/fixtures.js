// Hand-written fixtures covering every v1 block type — used to smoke-test
// BlockRenderer during development (see docs/ARCHITECTURE.md's builder
// section for how to re-run this check).
export const SAMPLE_BLOCKS = [
  {
    id: "1",
    type: "hero",
    props: {
      heading: "Sistemas que tiram você da operação",
      subheading: "Automação e produtos digitais para empresas que já cresceram do jeito manual.",
      ctaLabel: "Falar com a Tektone",
      ctaHref: "/contato",
      image: "",
    },
  },
  {
    id: "2",
    type: "richtext",
    props: {
      markdown:
        "## Por que isso importa\n\nEmpresas que dependem demais do fundador travam o crescimento. Um bom sistema resolve isso.\n\n- Reduz retrabalho\n- Libera tempo do time\n- Cria previsibilidade",
    },
  },
  {
    id: "3",
    type: "feature_grid",
    props: {
      heading: "O que entregamos",
      items: [
        { icon: "⚙️", title: "Automação", description: "Processos internos sem depender de você." },
        { icon: "📱", title: "Produtos", description: "Apps e SaaS construídos do zero." },
        { icon: "📈", title: "Receita", description: "Novas fontes de receita recorrente." },
      ],
    },
  },
  {
    id: "4",
    type: "testimonial",
    props: {
      items: [
        { quote: "Mudou como a empresa opera no dia a dia.", name: "Cliente Tektone", role: "CEO", avatar: "" },
      ],
    },
  },
  {
    id: "5",
    type: "pricing",
    props: {
      heading: "Planos",
      tiers: [
        { name: "Diagnóstico", price: "R$ 0", features: ["Sessão de 45min", "Mapa de gargalos"], ctaLabel: "Agendar" },
        { name: "Construção", price: "sob consulta", features: ["Sistema sob medida", "Suporte contínuo"], ctaLabel: "Falar com a gente" },
      ],
    },
  },
  {
    id: "6",
    type: "image",
    props: { src: "", alt: "placeholder", caption: "Ilustração de exemplo" },
  },
  {
    id: "7",
    type: "form_field",
    props: { label: "Qual seu e-mail?", fieldType: "email", required: true, options: [] },
  },
  {
    id: "8",
    type: "quiz_question",
    props: {
      label: "Você já tem um sistema interno?",
      type: "single",
      options: [
        { label: "Sim, funciona bem", value: "yes_good", scoreWeight: 0 },
        { label: "Sim, mas é bagunçado", value: "yes_messy", scoreWeight: 2 },
        { label: "Não tenho nenhum", value: "none", scoreWeight: 3 },
      ],
    },
  },
  {
    id: "9",
    type: "cta_band",
    props: { heading: "Pronto para sair da operação?", ctaLabel: "Agendar diagnóstico", ctaHref: "/contato" },
  },
];
