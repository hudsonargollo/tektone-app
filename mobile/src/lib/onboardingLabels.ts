// Mirrors worker/lib/onboardingRules.js's PROJECT_TYPE_LABEL keys (also
// duplicated in src/lib/onboardingLabels.js for web) — kept as a
// per-runtime duplicate, same precedent as auth.tsx's CRM_LADDER, so the
// CRM "won" form's project-type picker stays in lockstep with which types
// actually have a rule-based onboarding checklist.
export const PROJECT_TYPE_LABEL: Record<string, string> = {
  site_institucional: "Site institucional",
  loja_virtual: "Loja virtual",
  sistema_interno: "Sistema interno",
  app_mobile: "Aplicativo mobile",
  automacao: "Automação",
  outro: "Outro",
};
