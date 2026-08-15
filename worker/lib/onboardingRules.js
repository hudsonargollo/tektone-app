// Static per-project-type onboarding step sets (Phase 1 — no AI yet, see
// ~/.claude/plans/tektone-adaptive-onboarding.md). Each key is a
// `projects.project_type` value; steps are applied verbatim by
// onboardingService.buildPlan() when a won lead's projectType matches one
// of these. No match — including "outro", deliberately absent here — falls
// through to the "Onboarding padrão" workflow_template fallback in
// wonAutomation.js. This map only covers types with a real, distinct
// checklist worth having; "outro" is the explicit "use the default" choice.
export const ONBOARDING_RULES = {
  site_institucional: [
    { title: "Reunião de kickoff", description: "Alinhar objetivos, público-alvo e referências visuais com o cliente.", owner: "tektone", category: "kickoff", dueOffsetDays: 2 },
    { title: "Enviar logo em alta resolução", description: "Logo em vetor (SVG/AI) ou PNG de alta resolução com fundo transparente.", owner: "customer", category: "content", dueOffsetDays: 3 },
    { title: "Enviar textos e conteúdo das páginas", description: "Textos institucionais, sobre a empresa, serviços e diferenciais.", owner: "customer", category: "content", dueOffsetDays: 5 },
    { title: "Conceder acesso ao domínio/DNS", description: "Acesso ao painel do domínio para configurar o apontamento.", owner: "customer", category: "access", dueOffsetDays: 5 },
    { title: "Definir estrutura de páginas", description: "Mapear as páginas do site e a hierarquia de navegação.", owner: "tektone", category: "technical", dueOffsetDays: 4 },
    { title: "Desenvolvimento do site", description: "Construção das páginas conforme o brief e conteúdo recebido.", owner: "tektone", category: "technical", dueOffsetDays: 14 },
    { title: "Revisão do cliente", description: "Cliente revisa o site em ambiente de homologação e solicita ajustes.", owner: "customer", category: "launch", dueOffsetDays: 18 },
    { title: "Publicação", description: "Deploy em produção e apontamento final de domínio.", owner: "tektone", category: "launch", dueOffsetDays: 21 },
  ],
  loja_virtual: [
    { title: "Reunião de kickoff", description: "Alinhar catálogo, formas de pagamento e frete com o cliente.", owner: "tektone", category: "kickoff", dueOffsetDays: 2 },
    { title: "Enviar catálogo de produtos", description: "Lista de produtos com fotos, descrições, preços e variações.", owner: "customer", category: "content", dueOffsetDays: 5 },
    { title: "Definir meios de pagamento", description: "Escolher e configurar os gateways de pagamento (cartão, Pix, boleto).", owner: "customer", category: "technical", dueOffsetDays: 5 },
    { title: "Definir regras de frete", description: "Transportadoras, faixas de CEP e política de frete grátis, se houver.", owner: "customer", category: "technical", dueOffsetDays: 5 },
    { title: "Conceder acesso ao domínio/DNS", description: "Acesso ao painel do domínio para configurar o apontamento.", owner: "customer", category: "access", dueOffsetDays: 6 },
    { title: "Configuração da loja", description: "Setup da plataforma, catálogo, pagamento e frete.", owner: "tektone", category: "technical", dueOffsetDays: 18 },
    { title: "Teste de compra ponta a ponta", description: "Simular uma compra completa antes de publicar.", owner: "tektone", category: "launch", dueOffsetDays: 22 },
    { title: "Publicação", description: "Deploy em produção e apontamento final de domínio.", owner: "tektone", category: "launch", dueOffsetDays: 25 },
  ],
  sistema_interno: [
    { title: "Reunião de kickoff técnico", description: "Levantar processos atuais, usuários e integrações necessárias.", owner: "tektone", category: "kickoff", dueOffsetDays: 3 },
    { title: "Mapear usuários e permissões", description: "Quem vai usar o sistema e quais níveis de acesso cada um precisa.", owner: "customer", category: "access", dueOffsetDays: 5 },
    { title: "Enviar dados/planilhas atuais", description: "Dados existentes que precisam ser migrados ou usados como referência.", owner: "customer", category: "content", dueOffsetDays: 7 },
    { title: "Validar fluxo com o cliente", description: "Apresentar o fluxo desenhado antes de iniciar o desenvolvimento.", owner: "customer", category: "kickoff", dueOffsetDays: 10 },
    { title: "Desenvolvimento", description: "Construção do sistema conforme o fluxo validado.", owner: "tektone", category: "technical", dueOffsetDays: 30 },
    { title: "Treinamento da equipe", description: "Sessão de treinamento com os usuários finais do sistema.", owner: "tektone", category: "training", dueOffsetDays: 33 },
    { title: "Publicação", description: "Deploy em produção.", owner: "tektone", category: "launch", dueOffsetDays: 35 },
  ],
  app_mobile: [
    { title: "Reunião de kickoff", description: "Alinhar plataformas alvo (iOS/Android), funcionalidades e referências.", owner: "tektone", category: "kickoff", dueOffsetDays: 3 },
    { title: "Enviar identidade visual do app", description: "Ícone, splash screen, paleta de cores e fontes.", owner: "customer", category: "design", dueOffsetDays: 5 },
    { title: "Conceder acesso às lojas", description: "Acesso à conta Apple Developer e/ou Google Play Console.", owner: "customer", category: "access", dueOffsetDays: 7 },
    { title: "Definir integrações necessárias", description: "APIs externas, notificações push, pagamentos, etc.", owner: "customer", category: "technical", dueOffsetDays: 7 },
    { title: "Desenvolvimento", description: "Construção do app conforme o escopo definido.", owner: "tektone", category: "technical", dueOffsetDays: 35 },
    { title: "Testes com o cliente", description: "Build de teste (TestFlight/APK) para validação do cliente.", owner: "customer", category: "launch", dueOffsetDays: 38 },
    { title: "Publicação nas lojas", description: "Submissão para a Apple App Store e/ou Google Play.", owner: "tektone", category: "launch", dueOffsetDays: 42 },
  ],
  automacao: [
    { title: "Reunião de kickoff", description: "Mapear o processo manual atual e o resultado esperado da automação.", owner: "tektone", category: "kickoff", dueOffsetDays: 2 },
    { title: "Conceder acesso às ferramentas envolvidas", description: "Acessos/credenciais dos sistemas que farão parte da automação.", owner: "customer", category: "access", dueOffsetDays: 4 },
    { title: "Validar fluxo desenhado", description: "Aprovar o passo a passo da automação antes da implementação.", owner: "customer", category: "kickoff", dueOffsetDays: 6 },
    { title: "Implementação", description: "Construção e configuração da automação.", owner: "tektone", category: "technical", dueOffsetDays: 12 },
    { title: "Teste em paralelo", description: "Rodar a automação em paralelo ao processo manual antes de substituir.", owner: "tektone", category: "launch", dueOffsetDays: 15 },
    { title: "Ativação", description: "Desligar o processo manual e ativar a automação em definitivo.", owner: "tektone", category: "launch", dueOffsetDays: 17 },
  ],
};

export const PROJECT_TYPE_LABEL = {
  site_institucional: "Site institucional",
  loja_virtual: "Loja virtual",
  sistema_interno: "Sistema interno",
  app_mobile: "Aplicativo mobile",
  automacao: "Automação",
  outro: "Outro",
};
