// Mirrors worker/lib/onboardingRules.js's PROJECT_TYPE_LABEL keys — kept as
// a frontend-only duplicate (not shared as a package with the worker
// bundle) so every place that shows a project_type — the CRM's "won" form,
// the Hub sidebar's project tag — stays in lockstep with which types
// actually have a rule-based onboarding checklist. "outro" has no rule set
// on purpose: picking it (or leaving the field blank) falls back to the
// static "Onboarding padrão" template. See
// ~/.claude/plans/tektone-adaptive-onboarding.md.
export const PROJECT_TYPE_LABEL = {
  site_institucional: "Site institucional",
  loja_virtual: "Loja virtual",
  sistema_interno: "Sistema interno",
  app_mobile: "Aplicativo mobile",
  automacao: "Automação",
  outro: "Outro",
};
