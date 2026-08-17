// Port of src/builder/registry.js + src/builder/blocks/*.jsx's schema/
// defaultProps exports — the `Render` functions stay web-only (publish-time
// rendering, not needed for editing on mobile). Field-type contract matches
// BlockPropertyPanel.tsx's SchemaField exactly.
import type { SchemaField } from "@/components/BlockPropertyPanel";

export type BlockModule = {
  key: string;
  label: string;
  category: string;
  schema: SchemaField[];
  defaultProps: Record<string, any>;
};

const richtext: BlockModule = {
  key: "richtext",
  label: "Texto",
  category: "content",
  schema: [{ key: "markdown", label: "Markdown", type: "markdown" }],
  defaultProps: { markdown: "" },
};

const hero: BlockModule = {
  key: "hero",
  label: "Hero",
  category: "layout",
  schema: [
    { key: "heading", label: "Título", type: "text" },
    { key: "subheading", label: "Subtítulo", type: "textarea" },
    { key: "ctaLabel", label: "Texto do botão", type: "text" },
    { key: "ctaHref", label: "Link do botão", type: "url" },
    { key: "image", label: "Imagem", type: "image", optional: true },
  ],
  defaultProps: {
    heading: "Título da página",
    subheading: "Subtítulo explicando a proposta.",
    ctaLabel: "Falar com a gente",
    ctaHref: "",
    image: "",
  },
};

const feature_grid: BlockModule = {
  key: "feature_grid",
  label: "Grade de features",
  category: "layout",
  schema: [
    { key: "heading", label: "Título", type: "text", optional: true },
    {
      key: "items",
      label: "Features",
      type: "array",
      itemLabel: "Feature",
      fields: [
        { key: "icon", label: "Ícone (emoji)", type: "text", optional: true },
        { key: "title", label: "Título", type: "text" },
        { key: "description", label: "Descrição", type: "textarea" },
      ],
    },
  ],
  defaultProps: {
    heading: "",
    items: [{ icon: "✦", title: "Feature", description: "Descrição curta da feature." }],
  },
};

const testimonial: BlockModule = {
  key: "testimonial",
  label: "Depoimentos",
  category: "social_proof",
  schema: [
    {
      key: "items",
      label: "Depoimentos",
      type: "array",
      itemLabel: "Depoimento",
      fields: [
        { key: "quote", label: "Depoimento", type: "textarea" },
        { key: "name", label: "Nome", type: "text" },
        { key: "role", label: "Cargo/empresa", type: "text", optional: true },
        { key: "avatar", label: "Foto", type: "image", optional: true },
      ],
    },
  ],
  defaultProps: { items: [{ quote: "Depoimento do cliente.", name: "Nome", role: "", avatar: "" }] },
};

const pricing: BlockModule = {
  key: "pricing",
  label: "Preços",
  category: "conversion",
  schema: [
    { key: "heading", label: "Título", type: "text", optional: true },
    {
      key: "tiers",
      label: "Planos",
      type: "array",
      itemLabel: "Plano",
      fields: [
        { key: "name", label: "Nome", type: "text" },
        { key: "price", label: "Preço", type: "text" },
        { key: "features", label: "Itens (um por linha)", type: "list" },
        { key: "ctaLabel", label: "Texto do botão", type: "text", optional: true },
      ],
    },
  ],
  defaultProps: { heading: "", tiers: [{ name: "Plano", price: "R$ 0", features: ["Item 1"], ctaLabel: "Escolher" }] },
};

const cta_band: BlockModule = {
  key: "cta_band",
  label: "Faixa de CTA",
  category: "conversion",
  schema: [
    { key: "heading", label: "Título", type: "text" },
    { key: "ctaLabel", label: "Texto do botão", type: "text" },
    { key: "ctaHref", label: "Link do botão", type: "url" },
  ],
  defaultProps: { heading: "Pronto para começar?", ctaLabel: "Falar com a gente", ctaHref: "" },
};

const form_field: BlockModule = {
  key: "form_field",
  label: "Campo de formulário",
  category: "form",
  schema: [
    { key: "label", label: "Pergunta/Rótulo", type: "text" },
    {
      key: "fieldType",
      label: "Tipo",
      type: "select",
      options: [
        { label: "Texto curto", value: "text" },
        { label: "E-mail", value: "email" },
        { label: "Telefone", value: "phone" },
        { label: "Texto longo", value: "textarea" },
        { label: "Seleção", value: "select" },
      ],
    },
    { key: "required", label: "Obrigatório", type: "boolean" },
    { key: "options", label: "Opções (para seleção)", type: "list", optional: true },
  ],
  defaultProps: { label: "Pergunta", fieldType: "text", required: false, options: [] },
};

const quiz_question: BlockModule = {
  key: "quiz_question",
  label: "Pergunta de quiz",
  category: "quiz",
  schema: [
    { key: "label", label: "Pergunta", type: "text" },
    {
      key: "type",
      label: "Tipo",
      type: "select",
      options: [
        { label: "Escolha única", value: "single" },
        { label: "Múltipla escolha", value: "multi" },
        { label: "Texto livre", value: "text" },
      ],
    },
    {
      key: "options",
      label: "Opções",
      type: "array",
      itemLabel: "Opção",
      optional: true,
      fields: [
        { key: "label", label: "Texto", type: "text" },
        { key: "value", label: "Valor", type: "text" },
        { key: "scoreWeight", label: "Peso na pontuação", type: "number", optional: true },
      ],
    },
  ],
  defaultProps: { label: "Pergunta", type: "single", options: [{ label: "Opção A", value: "a", scoreWeight: 0 }] },
};

const image: BlockModule = {
  key: "image",
  label: "Imagem",
  category: "content",
  schema: [
    { key: "src", label: "Imagem", type: "image" },
    { key: "alt", label: "Texto alternativo", type: "text" },
    { key: "caption", label: "Legenda", type: "text", optional: true },
  ],
  defaultProps: { src: "", alt: "", caption: "" },
};

const MODULES: BlockModule[] = [richtext, hero, feature_grid, testimonial, pricing, cta_band, form_field, quiz_question, image];

export const BLOCK_REGISTRY: Record<string, BlockModule> = Object.fromEntries(MODULES.map((m) => [m.key, m]));

export const BLOCK_LIST = MODULES.map((m) => ({ key: m.key, label: m.label, category: m.category }));

export const ALLOWED_BLOCKS_BY_KIND: Record<string, string[]> = {
  page: ["hero", "richtext", "feature_grid", "testimonial", "pricing", "cta_band", "image"],
  form: ["form_field", "richtext", "image"],
  quiz: ["quiz_question", "richtext", "image"],
};

export function uid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, "");
}

export function createBlock(type: string) {
  const mod = BLOCK_REGISTRY[type];
  if (!mod) throw new Error(`Unknown block type: ${type}`);
  // JSON round-trip instead of structuredClone — no precedent for
  // structuredClone's availability on this RN/Hermes setup, and
  // defaultProps is always plain JSON-serializable data anyway.
  return { id: uid(), type, props: JSON.parse(JSON.stringify(mod.defaultProps)) };
}
