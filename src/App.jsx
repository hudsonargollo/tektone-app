import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertCircle, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { today } from "@/lib/constants";
import { Spinner } from "@/components/ui";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Board from "@/components/Board";
import CardModal from "@/components/CardModal";
import Login from "@/components/Login";

export default function App() {
  const [clients, setClients] = useState([]);
  const [cards, setCards] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [authed, setAuthed] = useState(null); // null = checking
  const [userEmail, setUserEmail] = useState(null);
  const searchRef = useRef(null);

  // ── Auth check ──────────────────────────────────────────────────────────────
  const refreshMe = useCallback(() => {
    api
      .me()
      .then(({ authed, email }) => {
        setAuthed(Boolean(authed));
        setUserEmail(email);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // ── Load (only once authed) ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ clients: cl }, { cards: cd }, { members: mb }] = await Promise.all([
        api.listClients(),
        api.listCards(),
        api.listMembers(),
      ]);
      setClients(cl);
      setCards(cd);
      setMembers(mb);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  async function logout() {
    await api.logout().catch(() => {});
    setAuthed(false);
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "n" && !editing) {
        e.preventDefault();
        newTask();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, activeId, clients]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const m = {};
    for (const c of clients) m[c.id] = cards.filter((k) => k.clientId === c.id).length;
    return m;
  }, [clients, cards]);

  const scopedCards = useMemo(
    () => (activeId ? cards.filter((c) => c.clientId === activeId) : cards),
    [cards, activeId]
  );

  const stats = useMemo(
    () => ({
      active: scopedCards.filter((c) => c.columnId !== "done").length,
      done: scopedCards.filter((c) => c.columnId === "done").length,
      overdue: scopedCards.filter(
        (c) => c.dueDate && c.dueDate < today() && c.columnId !== "done"
      ).length,
    }),
    [scopedCards]
  );

  const visibleCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedCards.filter((c) => {
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedCards, query, priorityFilter]);

  const activeClient = clients.find((c) => c.id === activeId);

  // ── Card mutations ──────────────────────────────────────────────────────────
  const quickAdd = useCallback(
    async (columnId, title) => {
      const body = {
        columnId,
        title,
        description: "",
        priority: "medium",
        clientId: activeId ?? clients[0]?.id ?? "",
        assignee: "",
        dueDate: "",
        labelColor: null,
      };
      setSaving(true);
      try {
        const { card } = await api.createCard(body);
        setCards((p) => [...p, card]);
      } catch (e) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    },
    [activeId, clients]
  );

  async function newTask() {
    const body = {
      columnId: "todo",
      title: "Nova tarefa",
      description: "",
      priority: "medium",
      clientId: activeId ?? clients[0]?.id ?? "",
      assignee: "",
      dueDate: "",
      labelColor: null,
    };
    setSaving(true);
    try {
      const { card } = await api.createCard(body);
      setCards((p) => [...p, card]);
      setEditing(card);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCard(updated) {
    setCards((p) => p.map((c) => (c.id === updated.id ? updated : c)));
    setSaving(true);
    try {
      await api.updateCard(updated.id, updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(id) {
    setCards((p) => p.filter((c) => c.id !== id));
    try {
      await api.deleteCard(id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function moveCard(id, columnId) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const updated = { ...card, columnId };
    setCards((p) => p.map((c) => (c.id === id ? updated : c)));
    try {
      await api.updateCard(id, updated);
    } catch {
      /* keep optimistic state; KV will reconcile on next load */
    }
  }

  // ── Client mutations ────────────────────────────────────────────────────────
  async function addClient(name, color) {
    try {
      const { client } = await api.createClient({ name, color });
      setClients((p) => [...p, client]);
      setActiveId(client.id);
    } catch (e) {
      setError(e.message);
    }
  }
  async function renameClient(id, name) {
    setClients((p) => p.map((c) => (c.id === id ? { ...c, name } : c)));
    api.updateClient(id, { name }).catch((e) => setError(e.message));
  }
  async function deleteClient(id) {
    setClients((p) => p.filter((c) => c.id !== id));
    setCards((p) => p.filter((c) => c.clientId !== id));
    if (activeId === id) setActiveId(null);
    api.deleteClient(id).catch((e) => setError(e.message));
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-base">
        <Spinner />
      </div>
    );
  }
  if (!authed) return <Login onAuthed={refreshMe} />;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-ink-base">
      {/* Brand bar */}
      <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-ink-base/80 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold tracking-[0.28em] text-white">
            TEKTONE
          </span>
          <span className="hidden font-mono text-[11px] tracking-[0.18em] text-zinc-600 sm:inline">
            / OPERAÇÕES
          </span>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="hidden font-mono text-[11px] tracking-wide text-zinc-500 md:inline">
              {userEmail}
            </span>
          )}
          <a
            href="https://tektone.com.br"
            className="hidden font-mono text-[11px] tracking-wide text-zinc-500 transition-colors hover:text-action sm:inline"
          >
            ← tektone.com.br
          </a>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-zinc-400 transition-colors hover:border-danger/40 hover:text-danger"
            title="Sair"
          >
            <LogOut size={12} /> sair
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bp-dots opacity-50" aria-hidden />

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-3 text-zinc-500">
            <Spinner />
            <span className="font-mono text-sm">carregando pipeline…</span>
          </div>
        ) : error ? (
          <div className="m-auto flex max-w-md items-start gap-3 rounded-xl border border-danger/30 bg-danger/[0.06] p-6 text-danger">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Erro ao carregar</p>
              <p className="mt-1 font-mono text-xs text-danger/80">{error}</p>
              <p className="mt-3 text-xs text-zinc-500">
                A API KV responde apenas no deploy (Pages Functions). Em dev local
                use <code className="text-zinc-400">wrangler pages dev</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-1 gap-6 overflow-hidden p-6">
            <Sidebar
              clients={clients}
              activeId={activeId}
              counts={counts}
              onSelect={setActiveId}
              onAdd={addClient}
              onRename={renameClient}
              onDelete={deleteClient}
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar
                title={activeClient ? activeClient.name : "Todos os Parceiros"}
                titleColor={activeClient?.color}
                stats={stats}
                query={query}
                setQuery={setQuery}
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                saving={saving}
                onNew={newTask}
                searchRef={searchRef}
              />
              <Board
                cards={visibleCards}
                clients={clients}
                onEdit={setEditing}
                onDelete={deleteCard}
                onQuickAdd={quickAdd}
                onMove={moveCard}
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <CardModal
            card={editing}
            clients={clients}
            members={members}
            onSave={saveCard}
            onDelete={deleteCard}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
