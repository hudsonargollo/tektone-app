import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  ArrowLeft,
  Sparkles,
  Pencil,
  Plus,
  Square,
  CheckSquare,
  Send,
  ClipboardList,
} from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, useIsMobile } from "@/components/ui";
import { Select, Segmented, MultiAssignee, DatePicker } from "@/components/CardModal";
import { PRIORITY } from "@/lib/constants";

const labelCls =
  "mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500";
const inputCls =
  "w-full rounded-lg border border-ink/15 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-stone-400 focus:border-action";

const genId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`)
    .replace(/-/g, "")
    .slice(0, 8);

function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

// One question, one field, one screen — the manual path's four steps, in the
// exact order/wording of functions/api/analyze/[[path]].js's
// INTERVIEW_SYSTEM_PROMPT sections, so the manual and AI-guided paths always
// describe the same four things the same way.
const MANUAL_STEPS = [
  {
    key: "manual-challenge",
    field: "challenge",
    headline: "Qual é o desafio?",
    hint: "Qual bug ou nova funcionalidade está sendo resolvido/construído.",
    placeholder: "Descreva o desafio…",
  },
  {
    key: "manual-method",
    field: "method",
    headline: "Qual é o método?",
    hint: "A abordagem, ferramentas ou processo usados — copywriting, edição de vídeo, software, campanha de marketing…",
    placeholder: "Descreva o método…",
  },
  {
    key: "manual-quest",
    field: "quest",
    headline: "Como foi a jornada?",
    hint: "Detalhes, novas ideias, descobertas, obstáculos técnicos pelo caminho.",
    placeholder: "Descreva a jornada…",
  },
  {
    key: "manual-victory",
    field: "victory",
    headline: "Qual é a vitória?",
    hint: "Como o resultado nasceu e como fortalece o negócio.",
    placeholder: "Descreva a vitória…",
    withChecklist: true,
  },
];

function composeDescription({ challenge, method, quest, victory }) {
  const parts = [];
  if (challenge.trim()) parts.push(`O DESAFIO\n${challenge.trim()}`);
  if (method.trim()) parts.push(`O MÉTODO\n${method.trim()}`);
  if (quest.trim()) parts.push(`A JORNADA\n${quest.trim()}`);
  if (victory.trim()) parts.push(`A VITÓRIA\n${victory.trim()}`);
  return parts.join("\n\n");
}

// Passo X de N — sits under the header on multi-screen chains (manual-fill).
function WizardProgress({ index, total }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= index ? "bg-action" : "bg-ink/10"
            }`}
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-[10px] text-stone-400">
        Passo {index + 1} de {total}
      </span>
    </div>
  );
}

// Small recap of what was picked on the "details" step — visible on every
// screen after it, so the user never has to backtrack just to check.
function SummaryChips({ clientId, clients, assignees, priority, dueDate }) {
  const client = clients.find((c) => c.id === clientId);
  const p = PRIORITY[priority];
  const chips = [];
  if (client) chips.push({ key: "client", label: client.name, dot: client.color });
  if (assignees.length)
    chips.push({ key: "assignees", label: assignees.length === 1 ? assignees[0].split(" ")[0] : `${assignees.length} pessoas` });
  if (p) chips.push({ key: "priority", label: p.label, dot: p.color });
  if (dueDate)
    chips.push({
      key: "due",
      label: new Date(`${dueDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    });
  if (!chips.length) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-ink/[0.03] px-2.5 py-1 font-mono text-[10px] text-stone-600"
        >
          {c.dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.dot }} />}
          {c.label}
        </span>
      ))}
    </div>
  );
}

// Mirrors CardModal's Checklist add/edit/toggle/remove interaction — kept as
// a local copy since Checklist isn't exported and is styled with that file's
// own local constants.
function ChecklistEditor({ items, onChange }) {
  const [text, setText] = useState("");
  const list = items ?? [];

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...list, { id: genId(), text: t, done: false }]);
    setText("");
  };
  const toggle = (id) => onChange(list.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const edit = (id, t) => onChange(list.map((i) => (i.id === id ? { ...i, text: t } : i)));
  const remove = (id) => onChange(list.filter((i) => i.id !== id));

  return (
    <div>
      <label className={labelCls}>Checklist</label>
      <div className="space-y-1">
        {list.map((i) => (
          <div key={i.id} className="group/item flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggle(i.id)}
              className={`shrink-0 transition-colors ${
                i.done ? "text-success" : "text-stone-400 hover:text-ink"
              }`}
            >
              {i.done ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <input
              value={i.text}
              onChange={(e) => edit(i.id, e.target.value)}
              className={`flex-1 bg-transparent text-sm outline-none ${
                i.done ? "text-stone-400 line-through" : "text-ink"
              }`}
            />
            <button
              type="button"
              onClick={() => remove(i.id)}
              className="shrink-0 rounded p-0.5 text-stone-300 opacity-0 transition-all hover:text-danger group-hover/item:opacity-100"
              title="Remover item"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Plus size={14} className="shrink-0 text-stone-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Adicionar item…"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-stone-400"
        />
      </div>
    </div>
  );
}

function ChatBubble({ from, children }) {
  const isAi = from === "ai";
  return (
    <div className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isAi ? "surface-3 text-ink" : "bg-action text-clay"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const HEADER_TITLES = {
  title: "Nova tarefa",
  details: "Projeto, prazo e responsáveis",
  choice: "Como você quer preencher?",
  "manual-challenge": "Preencher manualmente",
  "manual-method": "Preencher manualmente",
  "manual-quest": "Preencher manualmente",
  "manual-victory": "Preencher manualmente",
  "ai-chat": "Entrevista guiada por IA",
  review: "Revisar e criar",
};

const slideVariants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

// mode: "create" (from "Nova tarefa") | "backfill" (from CardModal, `card` present)
export default function TaskWizard({ mode, card, seedDefaults, members, clients, avatarByName, onClose, onCreated, onUpdated }) {
  const isBackfill = mode === "backfill";
  const isMobile = useIsMobile();
  const [step, setStep] = useState(isBackfill ? "choice" : "title");

  const [title, setTitle] = useState(isBackfill ? card?.title || "" : "");
  const [sections, setSections] = useState({ challenge: "", method: "", quest: "", victory: "" });
  const [checklist, setChecklist] = useState([]);
  const [description, setDescription] = useState("");

  // Details step state — project/assignees/priority/deadline. Seeded from the
  // backfilled card's current values, or from seedDefaults on create.
  const source = isBackfill ? card : seedDefaults;
  const [clientId, setClientId] = useState(source?.clientId ?? "");
  const [assignees, setAssignees] = useState(
    source?.assignees?.length ? source.assignees : source?.assignee ? [source.assignee] : []
  );
  const [priority, setPriority] = useState(source?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(source?.dueDate ?? "");

  const [turns, setTurns] = useState([]); // [{question, section, answer}]
  const [currentQuestion, setCurrentQuestion] = useState(null); // {text, section}
  const [userReply, setUserReply] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);
  useEffect(() => {
    if (step === "ai-chat") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step, turns, currentQuestion, chatBusy]);

  const manualIndex = MANUAL_STEPS.findIndex((s) => s.key === step);
  const isManualStep = manualIndex !== -1;
  const showSummary = step !== "title" && step !== "details" && step !== "choice";

  function applyFinal(res) {
    setDescription(res.description);
    setChecklist((res.checklist || []).map((t) => ({ id: genId(), text: t, done: false })));
    setStep("review");
  }

  async function startInterview() {
    setStep("ai-chat");
    setChatError("");
    setChatBusy(true);
    try {
      const res = await api.interviewTurn({ seedTitle: title, turns: [], finalize: false });
      if (res.done) applyFinal(res);
      else setCurrentQuestion({ text: res.question, section: res.section });
    } catch (e) {
      setChatError(e.body?.error || "Falha ao iniciar a entrevista. Verifique a chave da Anthropic.");
    } finally {
      setChatBusy(false);
    }
  }

  async function sendReply(finalize = false) {
    if (!currentQuestion || chatBusy) return;
    const typed = userReply.trim();
    if (!typed && !finalize) return;

    const prevTurns = turns;
    const prevQuestion = currentQuestion;
    const answer = typed || "(sem resposta adicional)";
    const nextTurns = [...turns, { question: currentQuestion.text, section: currentQuestion.section, answer }];

    setTurns(nextTurns);
    setCurrentQuestion(null);
    setUserReply("");
    setChatBusy(true);
    setChatError("");
    try {
      const res = await api.interviewTurn({ seedTitle: title, turns: nextTurns, finalize });
      if (res.done) applyFinal(res);
      else setCurrentQuestion({ text: res.question, section: res.section });
    } catch (e) {
      // restore so the user doesn't lose their typed answer
      setTurns(prevTurns);
      setCurrentQuestion(prevQuestion);
      setUserReply(typed);
      setChatError(e.body?.error || "Falha ao continuar a entrevista.");
    } finally {
      setChatBusy(false);
    }
  }

  async function handleFinalSubmit() {
    setBusy(true);
    setError("");
    const details = { clientId, assignees, assignee: assignees[0] ?? "", priority, dueDate };
    try {
      if (isBackfill) {
        const { card: saved } = await api.updateCard(card.id, { description, checklist, ...details });
        onUpdated(saved);
      } else {
        const body = { ...seedDefaults, ...details, title: title.trim() || "Nova tarefa", description, checklist };
        const { card: saved } = await api.createCard(body);
        onCreated(saved);
      }
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar a tarefa.");
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    if (step === "details") setStep("title");
    else if (step === "choice") setStep("details");
    else if (isManualStep) {
      setStep(manualIndex === 0 ? "choice" : MANUAL_STEPS[manualIndex - 1].key);
    } else if (step === "ai-chat") {
      setTurns([]);
      setCurrentQuestion(null);
      setUserReply("");
      setChatError("");
      setStep("choice");
    }
  }
  const canGoBack =
    (step === "details" && !isBackfill) ||
    (step === "choice" && !isBackfill) ||
    isManualStep ||
    step === "ai-chat";

  return (
    <div className="fixed inset-0 z-50 flex justify-center lg:items-center lg:p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className={`relative flex w-full flex-col overflow-hidden surface-2 shadow-2xl ${
          isMobile ? "h-full" : "max-h-[92vh] max-w-2xl rounded-2xl"
        }`}
        initial={isMobile ? { y: "100%" } : { opacity: 0, y: 20, scale: 0.97 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
        exit={isMobile ? { y: "100%" } : { opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {canGoBack && (
              <button
                onClick={goBack}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                title="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "rgba(46,74,67,0.15)", color: "#2e4a43" }}
            >
              <ClipboardList size={15} />
            </span>
            <span className="text-sm font-bold text-ink">{HEADER_TITLES[step]}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {error && <p className="mb-4 font-mono text-[11px] text-danger">{error}</p>}
          {isManualStep && <WizardProgress index={manualIndex} total={MANUAL_STEPS.length} />}
          {showSummary && (
            <SummaryChips clientId={clientId} clients={clients} assignees={assignees} priority={priority} dueDate={dueDate} />
          )}

          <AnimatePresence mode="wait">
            {step === "title" && (
              <motion.div
                key="title"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
              >
                <h3 className="mb-1 text-lg font-bold text-ink">Qual é a tarefa?</h3>
                <p className="mb-4 font-mono text-[11px] text-stone-500">Um título curto — os detalhes vêm a seguir.</p>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim()) {
                      e.preventDefault();
                      setStep("details");
                    }
                  }}
                  placeholder="Título da tarefa…"
                  className={inputCls}
                />
              </motion.div>
            )}

            {step === "details" && (
              <motion.div
                key="details"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <h3 className="mb-1 text-lg font-bold text-ink">Quem, onde e até quando?</h3>
                <p className="mb-1 font-mono text-[11px] text-stone-500">
                  Opcional agora, mas ajuda o time a encontrar essa tarefa depois.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Projeto">
                    <Select
                      value={clientId}
                      onChange={setClientId}
                      options={[{ value: "", label: "— Nenhum —" }, ...clients.map((c) => ({ value: c.id, label: c.name, dot: c.color }))]}
                      placeholder="Projeto"
                    />
                  </Field>
                  <Field label="Prazo">
                    <DatePicker value={dueDate} onChange={setDueDate} />
                  </Field>
                </div>
                <Field label="Responsáveis">
                  <MultiAssignee members={members} value={assignees} onChange={setAssignees} avatarByName={avatarByName} />
                </Field>
                <Field label="Prioridade">
                  <Segmented
                    value={priority}
                    onChange={setPriority}
                    options={Object.entries(PRIORITY).map(([k, v]) => ({ value: k, label: v.label, color: v.color }))}
                  />
                </Field>
              </motion.div>
            )}

            {step === "choice" && (
              <motion.div
                key="choice"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <button
                  type="button"
                  onClick={() => setStep(MANUAL_STEPS[0].key)}
                  className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-ink/15 px-4 py-5 text-center transition-colors hover:border-action/40 hover:bg-ink/[0.02]"
                >
                  <Pencil size={18} className="text-stone-500" />
                  <span className="text-sm font-semibold text-ink">Preencher manualmente</span>
                  <span className="font-mono text-[10px] text-stone-500">Você escreve, no seu ritmo</span>
                </button>
                <button type="button" onClick={startInterview} className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-ink/15 px-4 py-5 text-center transition-colors hover:border-action/40 hover:bg-ink/[0.02]">
                  <Sparkles size={18} className="text-action" />
                  <span className="text-sm font-semibold text-ink">
                    Sugerir Melhor<span className="font-extrabold text-action">IA</span>s
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">Entrevista guiada por IA</span>
                </button>
              </motion.div>
            )}

            {isManualStep && (
              <motion.div
                key={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-ink">{MANUAL_STEPS[manualIndex].headline}</h3>
                <p className="-mt-2 font-mono text-[11px] text-stone-500">{MANUAL_STEPS[manualIndex].hint}</p>
                <textarea
                  autoFocus
                  rows={6}
                  value={sections[MANUAL_STEPS[manualIndex].field]}
                  onChange={(e) =>
                    setSections((s) => ({ ...s, [MANUAL_STEPS[manualIndex].field]: e.target.value }))
                  }
                  placeholder={MANUAL_STEPS[manualIndex].placeholder}
                  className={`${inputCls} resize-none`}
                />
                {MANUAL_STEPS[manualIndex].withChecklist && (
                  <ChecklistEditor items={checklist} onChange={setChecklist} />
                )}
              </motion.div>
            )}

            {step === "ai-chat" && (
              <motion.div
                key="ai-chat"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
              >
                <div className="space-y-3">
                  {turns.map((t, i) => (
                    <div key={i} className="space-y-2">
                      <ChatBubble from="ai">{t.question}</ChatBubble>
                      <ChatBubble from="user">{t.answer}</ChatBubble>
                    </div>
                  ))}
                  {currentQuestion && <ChatBubble from="ai">{currentQuestion.text}</ChatBubble>}
                  {chatBusy && !currentQuestion && (
                    <div className="flex items-center gap-2 text-stone-400">
                      <Spinner /> <span className="font-mono text-[11px]">pensando…</span>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="mt-3 rounded-lg border border-ink/15 bg-ink/[0.02] p-2">
                  <textarea
                    rows={2}
                    value={userReply}
                    onChange={(e) => setUserReply(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        sendReply(false);
                      }
                    }}
                    placeholder={currentQuestion ? "Digite sua resposta…" : "Aguardando a próxima pergunta…"}
                    disabled={chatBusy || !currentQuestion}
                    className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-stone-400 disabled:opacity-50"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => sendReply(true)}
                      disabled={chatBusy || !currentQuestion}
                      className="font-mono text-[11px] text-stone-500 transition-colors hover:text-ink disabled:opacity-40"
                    >
                      Finalizar agora
                    </button>
                    <button
                      type="button"
                      onClick={() => sendReply(false)}
                      disabled={chatBusy || !currentQuestion || !userReply.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-[12px] font-bold text-clay transition-all hover:brightness-110 disabled:opacity-40"
                    >
                      <Send size={12} /> Enviar
                    </button>
                  </div>
                </div>
                {chatError && <p className="mt-2 font-mono text-[11px] text-danger">{chatError}</p>}
              </motion.div>
            )}

            {step === "review" && (
              <motion.div
                key="review"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <Field label="Descrição">
                  <textarea
                    rows={10}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
                <ChecklistEditor items={checklist} onChange={setChecklist} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-4 py-4 sm:px-6">
          <span className="font-mono text-[10px] text-stone-400">
            {step === "ai-chat" ? "Powered by Claude" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-500 transition-colors hover:text-ink"
            >
              Cancelar
            </button>
            {step === "title" && (
              <button
                type="button"
                onClick={() => title.trim() && setStep("details")}
                disabled={!title.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-40"
              >
                Continuar
              </button>
            )}
            {step === "details" && (
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action"
              >
                Continuar
              </button>
            )}
            {isManualStep && (
              <button
                type="button"
                onClick={() => {
                  if (manualIndex < MANUAL_STEPS.length - 1) {
                    setStep(MANUAL_STEPS[manualIndex + 1].key);
                  } else {
                    setDescription(composeDescription(sections));
                    setStep("review");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action"
              >
                {manualIndex < MANUAL_STEPS.length - 1 ? "Continuar" : "Revisar"}
              </button>
            )}
            {step === "review" && (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={busy || !description.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-50"
              >
                {busy ? <Spinner /> : <Check size={14} />} {isBackfill ? "Salvar" : "Criar tarefa"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
