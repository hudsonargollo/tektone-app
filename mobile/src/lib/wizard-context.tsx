// Shared state for the task-creation wizard, ported from web's
// TaskWizard.jsx. Web keeps the whole step machine as one component's local
// state; on mobile each step is a routed screen, so the same state lives
// here instead, scoped to the /wizard/* route group via WizardProvider in
// wizard/_layout.tsx (created once per wizard session, torn down on exit).
import { createContext, useContext, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";

const genId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, "").slice(0, 8);

export type ChecklistItem = { id: string; text: string; done: boolean };
export type WizardSections = { challenge: string; method: string; quest: string; victory: string };
export type WizardTurn = { question: string; section: string; answer: string };
export type WizardMode = "create" | "backfill";
export type WizardMember = { id: string; name: string; email: string };
export type WizardClient = { id: string; name: string; color: string };

type WizardCtx = {
  mode: WizardMode;
  cardId: string | null;
  title: string;
  setTitle: (t: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  assignees: string[];
  setAssignees: (v: string[]) => void;
  priority: string;
  setPriority: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  // Populated once by wizard/details.tsx on mount, reused by every later
  // screen (manual-*, review) so they don't each re-fetch the same lists.
  members: WizardMember[];
  setMembers: (m: WizardMember[]) => void;
  clients: WizardClient[];
  setClients: (c: WizardClient[]) => void;
  sections: WizardSections;
  setSections: (s: WizardSections) => void;
  checklist: ChecklistItem[];
  setChecklist: (c: ChecklistItem[]) => void;
  description: string;
  setDescription: (d: string) => void;
  turns: WizardTurn[];
  currentQuestion: { text: string; section: string } | null;
  chatBusy: boolean;
  chatError: string;
  finished: boolean;
  busy: boolean;
  error: string;
  composeDescription: () => string;
  startInterview: () => Promise<void>;
  sendReply: (answer: string, finalize?: boolean) => Promise<void>;
  submit: () => Promise<{ id: string } | null>;
};

const Ctx = createContext<WizardCtx | null>(null);

export function WizardProvider({
  children,
  mode,
  cardId,
  initialTitle,
  initialClientId,
  initialAssignees,
  initialPriority,
  initialDueDate,
  seedDefaults,
}: {
  children: ReactNode;
  mode: WizardMode;
  cardId: string | null;
  initialTitle: string;
  initialClientId: string;
  initialAssignees: string[];
  initialPriority: string;
  initialDueDate: string;
  seedDefaults: Record<string, unknown>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [clientId, setClientId] = useState(initialClientId);
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);
  const [priority, setPriority] = useState(initialPriority);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [members, setMembers] = useState<WizardMember[]>([]);
  const [clients, setClients] = useState<WizardClient[]>([]);
  const [sections, setSections] = useState<WizardSections>({ challenge: "", method: "", quest: "", victory: "" });
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [description, setDescription] = useState("");
  const [turns, setTurns] = useState<WizardTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<{ text: string; section: string } | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function composeDescription() {
    const parts: string[] = [];
    if (sections.challenge.trim()) parts.push(`O DESAFIO\n${sections.challenge.trim()}`);
    if (sections.method.trim()) parts.push(`O MÉTODO\n${sections.method.trim()}`);
    if (sections.quest.trim()) parts.push(`A JORNADA\n${sections.quest.trim()}`);
    if (sections.victory.trim()) parts.push(`A VITÓRIA\n${sections.victory.trim()}`);
    return parts.join("\n\n");
  }

  function applyFinal(res: { description: string; checklist: string[] }) {
    setDescription(res.description);
    setChecklist((res.checklist || []).map((t) => ({ id: genId(), text: t, done: false })));
    setFinished(true);
  }

  async function startInterview() {
    setChatError("");
    setChatBusy(true);
    try {
      const res = await api.interviewTurn({ seedTitle: title, turns: [], finalize: false });
      if (res.done) applyFinal(res);
      else setCurrentQuestion({ text: res.question, section: res.section });
    } catch (e) {
      setChatError(e instanceof ApiError ? e.body?.error || "Falha ao iniciar a entrevista." : "Falha ao iniciar a entrevista.");
    } finally {
      setChatBusy(false);
    }
  }

  async function sendReply(answerRaw: string, finalize = false) {
    if (!currentQuestion) return;
    const typed = answerRaw.trim();
    if (!typed && !finalize) return;
    const answer = typed || "(sem resposta adicional)";
    const prevTurns = turns;
    const prevQuestion = currentQuestion;
    const nextTurns = [...turns, { question: currentQuestion.text, section: currentQuestion.section, answer }];

    setTurns(nextTurns);
    setCurrentQuestion(null);
    setChatBusy(true);
    setChatError("");
    try {
      const res = await api.interviewTurn({ seedTitle: title, turns: nextTurns, finalize });
      if (res.done) applyFinal(res);
      else setCurrentQuestion({ text: res.question, section: res.section });
    } catch (e) {
      // restore so the typed answer isn't lost
      setTurns(prevTurns);
      setCurrentQuestion(prevQuestion);
      setChatError(e instanceof ApiError ? e.body?.error || "Falha ao continuar a entrevista." : "Falha ao continuar a entrevista.");
    } finally {
      setChatBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    const details = { clientId, assignees, assignee: assignees[0] ?? "", priority, dueDate };
    try {
      if (mode === "backfill" && cardId) {
        const { card } = await api.updateCard(cardId, { description, checklist, ...details });
        return card;
      }
      const body = { ...seedDefaults, ...details, title: title.trim() || "Nova tarefa", description, checklist };
      const { card } = await api.createCard(body);
      return card;
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao salvar a tarefa." : "Falha ao salvar a tarefa.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Ctx.Provider
      value={{
        mode,
        cardId,
        title,
        setTitle,
        clientId,
        setClientId,
        assignees,
        setAssignees,
        priority,
        setPriority,
        dueDate,
        setDueDate,
        members,
        setMembers,
        clients,
        setClients,
        sections,
        setSections,
        checklist,
        setChecklist,
        description,
        setDescription,
        turns,
        currentQuestion,
        chatBusy,
        chatError,
        finished,
        busy,
        error,
        composeDescription,
        startInterview,
        sendReply,
        submit,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
