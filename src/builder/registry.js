import * as richtext from "./blocks/richtext.jsx";
import * as hero from "./blocks/hero.jsx";
import * as feature_grid from "./blocks/feature_grid.jsx";
import * as testimonial from "./blocks/testimonial.jsx";
import * as pricing from "./blocks/pricing.jsx";
import * as cta_band from "./blocks/cta_band.jsx";
import * as form_field from "./blocks/form_field.jsx";
import * as quiz_question from "./blocks/quiz_question.jsx";
import * as image from "./blocks/image.jsx";

// One module per block type — each exports {key, label, category, schema,
// defaultProps, Render}. `Render` is the single component used both in the
// builder's live canvas and at publish time, so canvas and shipped page can
// never drift apart (see docs/ARCHITECTURE.md's builder section).
const MODULES = [
  richtext,
  hero,
  feature_grid,
  testimonial,
  pricing,
  cta_band,
  form_field,
  quiz_question,
  image,
];

export const BLOCK_REGISTRY = Object.fromEntries(MODULES.map((m) => [m.key, m]));

export const BLOCK_LIST = MODULES.map((m) => ({
  key: m.key,
  label: m.label,
  category: m.category,
}));

// form/quiz documents render publicly as a one-question-per-step wizard
// (see marketing/components/FormWizard.tsx) — only form_field/quiz_question
// answer the document's own kind, plus richtext/image for intro copy.
// Landing-page blocks (hero, pricing, ...) don't fit that flow.
export const ALLOWED_BLOCKS_BY_KIND = {
  page: ["hero", "richtext", "feature_grid", "testimonial", "pricing", "cta_band", "image"],
  form: ["form_field", "richtext", "image"],
  quiz: ["quiz_question", "richtext", "image"],
};

export function createBlock(type) {
  const mod = BLOCK_REGISTRY[type];
  if (!mod) throw new Error(`Unknown block type: ${type}`);
  return {
    id: crypto.randomUUID(),
    type,
    props: structuredClone(mod.defaultProps),
  };
}
