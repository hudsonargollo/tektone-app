import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, LogOut, ShieldCheck, Menu, X, Sparkles, Package, Download, LayoutGrid } from "lucide-react";
import { api } from "@/lib/api";
import { today } from "@/lib/constants";
import { useRealtime } from "@/lib/useRealtime";
import { fireDuotoneConfetti } from "@/lib/confetti";
import { Spinner, Avatar } from "@/components/ui";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Board from "@/components/Board";
import CardModal from "@/components/CardModal";
import TaskWizard from "@/components/TaskWizard";
import NudgeToast from "@/components/NudgeToast";
import Login from "@/components/Login";
import AdminPanel from "@/components/AdminPanel";
import ProfilePage from "@/components/ProfilePage";
import ReviewPopup from "@/components/ReviewPopup";
import MeetingIntelligence from "@/components/MeetingIntelligence";
import MeetingFetch from "@/components/MeetingFetch";
import NotificationsBell from "@/components/NotificationsBell";
import LogoMark from "@/components/LogoMark";

export default function App() {
  const [clients, setClients] = useState([]);
  const [cards, setCards] = useState([]);
  const [members, setMembers] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [wizard, setWizard] = useState(null); // null | {mode:"create"} | {mode:"backfill", card}
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [requestsOnly, setRequestsOnly] = useState(false);
  const [authed, setAuthed] = useState(null); // null = checking
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userAvatar, setUserAvatar] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [showFetch, setShowFetch] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewActiveId, setReviewActiveId] = useState(null); // current carousel slide (meeting id)
  const [notifSignal, setNotifSignal] = useState(0);
  const [shake, setShake] = useState(false);
  const [nudgeToasts, setNudgeToasts] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef(null);
  const deepLinkHandled = useRef(false);

  // ── Auth check ──────────────────────────────────────────────────────────────
  const refreshMe = useCallback(() => {
    api
      .me()
      .then(({ authed, email, admin, name, avatar }) => {
        setAuthed(Boolean(authed));
        setUserEmail(email);
        setIsAdmin(Boolean(admin));
        setUserName(name);
        setUserAvatar(avatar);
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
      const [{ clients: cl }, { cards: cd }, { members: mb }, dir] = await Promise.all([
        api.listClients(),
        api.listCards(),
        api.listMembers(),
        api.directory().catch(() => ({ users: [] })),
      ]);
      setClients(cl);
      setCards(cd);
      setMembers(mb);
      setDirectory(dir.users ?? []);
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

  // Silent card refetch — used by the realtime channel below, which shouldn't
  // flip the full-board loading spinner on every broadcast.
  const refreshCards = useCallback(() => {
    api.listCards().then(({ cards: cd }) => setCards(cd)).catch(() => {});
  }, []);

  // Pending meeting-notes review batches for this user (validation popup).
  useEffect(() => {
    if (!authed) return;
    api
      .listReviews()
      .then(({ reviews }) => setReviews(reviews || []))
      .catch(() => {});
  }, [authed]);

  async function ackReviews(ids) {
    setReviews([]);
    try {
      await api.ackReviews(ids);
    } catch {
      /* if ack fails it simply reappears next login */
    }
  }

  // Validate a single meeting batch (one carousel slide) without touching the rest.
  async function ackOneReview(id) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    if (reviewActiveId === id) setReviewActiveId(null); // fall back to the first slide
    try {
      await api.ackReviews([id]);
    } catch {
      /* if ack fails it simply reappears next login */
    }
  }

  // ── Comment notifications (per-user unread) ───────────────────────────────────
  // The bell owns its own polling/state; we just nudge it after relevant events.
  const bumpNotifs = () => setNotifSignal((s) => s + 1);

  const dismissNudgeToast = (id) => setNudgeToasts((t) => t.filter((x) => x.id !== id));

  // Realtime board events — broadcast-all, filtered client-side by recipient.
  const onRealtimeEvent = useCallback(
    (evt) => {
      const me = String(userEmail || "").toLowerCase();
      if (evt.type === "card:reviewed") {
        fireDuotoneConfetti();
        refreshCards();
        bumpNotifs();
      } else if (evt.type === "comment:mention" && evt.recipients?.map((e) => e.toLowerCase()).includes(me)) {
        bumpNotifs();
      } else if (evt.type === "card:assigned" && evt.recipients?.map((e) => e.toLowerCase()).includes(me)) {
        refreshCards();
        bumpNotifs();
      } else if (evt.type === "card:reopened" && evt.recipients?.map((e) => e.toLowerCase()).includes(me)) {
        refreshCards();
        bumpNotifs();
      } else if (evt.type === "nudge" && String(evt.to || "").toLowerCase() === me) {
        bumpNotifs();
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setNudgeToasts((t) => [
          ...t,
          { id: evt.id, fromName: evt.fromName, cardTitle: evt.cardTitle, cardId: evt.cardId },
        ]);
        setTimeout(() => dismissNudgeToast(evt.id), 6000);
      }
    },
    [refreshCards, userEmail]
  );
  useRealtime(authed, onRealtimeEvent);

  function openCard(card) {
    setEditing(card);
    api.markCardSeen(card.id).then(bumpNotifs).catch(() => {});
  }
  const openCardById = (id) => {
    const c = cards.find((x) => x.id === id);
    if (c) openCard(c);
  };

  // Deep link from email: tasks.tektone.com.br/?card=<id> opens that card.
  useEffect(() => {
    if (deepLinkHandled.current || loading || !cards.length) return;
    const cardId = new URLSearchParams(window.location.search).get("card");
    if (!cardId) return;
    deepLinkHandled.current = true;
    const card = cards.find((c) => c.id === cardId);
    if (card) openCard(card);
    window.history.replaceState({}, "", window.location.pathname);
  }, [cards, loading]); // eslint-disable-line react-hooks/exhaustive-deps

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
      } else if (e.key.toLowerCase() === "n" && !editing && !wizard) {
        e.preventDefault();
        setWizard({ mode: "create" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, wizard]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  // Map an assignee (stored as a member name) → avatar. Joins the user
  // directory directly by name, and via member email when names differ.
  const avatarByName = useMemo(() => {
    const norm = (s) => String(s || "").trim().toLowerCase();
    const map = {};
    for (const u of directory) {
      if (u.avatar && u.name) map[norm(u.name)] = u.avatar;
    }
    for (const m of members) {
      const u = directory.find((x) => norm(x.email) === norm(m.email));
      if (u?.avatar) map[norm(m.name)] = u.avatar;
    }
    return map;
  }, [directory, members]);

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

  const hasOpenRequest = (c) =>
    (c.comments ?? []).some((x) => x.kind === "request" && !x.resolvedAt);

  const openRequestsScoped = useMemo(
    () => scopedCards.filter(hasOpenRequest).length,
    [scopedCards]
  );
  const openRequestsGlobal = useMemo(() => cards.filter(hasOpenRequest).length, [cards]);

  const visibleCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedCards.filter((c) => {
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (requestsOnly && !hasOpenRequest(c)) return false;
      if (q) {
        const hay = `${c.title} ${c.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedCards, query, priorityFilter, requestsOnly]);

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
        assignees: [],
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

  const seedDefaults = {
    columnId: "todo",
    priority: "medium",
    clientId: activeId ?? clients[0]?.id ?? "",
    assignee: "",
    assignees: [],
    dueDate: "",
    labelColor: null,
  };

  async function saveCard(updated) {
    setCards((p) => p.map((c) => (c.id === updated.id ? updated : c)));
    setSaving(true);
    try {
      // comments are owned by the comment endpoints — never send them on a card edit
      const { comments, ...rest } = updated;
      await api.updateCard(updated.id, rest);
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
    // A plain column-level drop (not onto a specific card) always appends
    // to the end of the target column's manual order.
    const maxOrder = Math.max(
      -1,
      ...cards.filter((c) => c.columnId === columnId && c.id !== id).map((c) => c.order ?? 0)
    );
    const updated = { ...card, columnId, order: maxOrder + 1 };
    setCards((p) => p.map((c) => (c.id === id ? updated : c)));
    try {
      const { comments, ...rest } = updated;
      await api.updateCard(id, rest);
    } catch {
      /* keep optimistic state; KV will reconcile on next load */
    }
  }

  // Manual within-column reorder (and, combined with moveCard, a
  // drag-onto-a-specific-card cross-column move too).
  async function reorderCards(columnId, orderedIds) {
    const orderIndex = new Map(orderedIds.map((cardId, i) => [cardId, i]));
    setCards((p) =>
      p.map((c) => (c.columnId === columnId && orderIndex.has(c.id) ? { ...c, order: orderIndex.get(c.id) } : c))
    );
    try {
      await api.reorderCards(columnId, orderedIds);
    } catch {
      /* keep optimistic state; KV will reconcile on next load */
    }
  }

  // Approve + move to Done. The confetti itself fires from the realtime
  // broadcast (useRealtime above), same as for every other connected viewer.
  async function reviewCard(id) {
    try {
      const { card } = await api.reviewCard(id);
      setCards((p) => p.map((c) => (c.id === card.id ? card : c)));
      bumpNotifs();
    } catch (e) {
      setError(e.message);
    }
  }

  async function reviewCardsBulk(ids) {
    try {
      const { cards: updatedCards } = await api.reviewCardsBulk(ids);
      const byId = new Map(updatedCards.map((c) => [c.id, c]));
      setCards((p) => p.map((c) => byId.get(c.id) ?? c));
      bumpNotifs();
    } catch (e) {
      setError(e.message);
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
      <div className="flex h-screen items-center justify-center bg-clay">
        <Spinner />
      </div>
    );
  }
  if (!authed) return <Login onAuthed={refreshMe} />;

  // ── Render ──────────────────────────────────────────────────────────────────
  const sidebarProps = {
    clients,
    activeId,
    counts,
    onAdd: addClient,
    onRename: renameClient,
    onDelete: deleteClient,
  };

  return (
    <div className={`flex h-[100dvh] flex-col bg-clay ${shake ? "animate-tk-shake" : ""}`}>
      <div className="grain-overlay" aria-hidden />
      <NudgeToast toasts={nudgeToasts} onOpen={openCardById} onDismiss={dismissNudgeToast} />

      {/* Brand bar */}
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-ink/10 bg-clay/80 px-4 backdrop-blur-xl lg:px-5">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-lg p-1.5 text-ink transition-colors hover:bg-ink/[0.05] lg:hidden"
            aria-label="Abrir projetos"
          >
            <Menu size={20} />
          </button>
          <LogoMark className="h-7 w-auto" />
          <span className="text-sm font-semibold tracking-[0.28em] text-ink sm:tracking-[0.3em]">
            TEKTONE
          </span>
          <span className="serif hidden text-[13px] text-stone-500 md:inline">
            Operações
          </span>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <NotificationsBell
            authed={authed}
            avatarByName={avatarByName}
            onOpenCard={openCardById}
            refreshSignal={notifSignal}
          />
          {userEmail && (
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-ink/[0.05]"
              title="Meu perfil"
            >
              <Avatar name={userName || userEmail} src={userAvatar} />
              <span className="font-mono text-[11px] tracking-wide text-stone-500">
                {userName || userEmail}
              </span>
            </button>
          )}
          {openRequestsGlobal > 0 && (
            <button
              onClick={() => {
                setActiveId(null);
                setRequestsOnly(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-warning transition-colors hover:bg-warning/20"
              title={`${openRequestsGlobal} solicitação(ões) em aberto`}
            >
              <Package size={12} /> {openRequestsGlobal}{" "}
              {openRequestsGlobal === 1 ? "solicitação" : "solicitações"}
            </button>
          )}
          <button
            onClick={() => setShowIntel(true)}
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-stone-500 transition-colors hover:border-action/40 hover:text-action"
            title="Analisar transcrição de reunião"
          >
            <Sparkles size={12} /> reuniões
          </button>
          <a
            href="https://tektone.com.br"
            className="font-mono text-[11px] tracking-wide text-stone-500 transition-colors hover:text-action"
          >
            ← tektone.com.br
          </a>
          {isAdmin && (
            <button
              onClick={() => setShowFetch(true)}
              className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-stone-500 transition-colors hover:border-action/40 hover:text-action"
              title="Buscar reuniões do Drive"
            >
              <Download size={12} /> buscar
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-stone-500 transition-colors hover:border-action/40 hover:text-action"
            >
              <ShieldCheck size={12} /> admin
            </button>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-stone-500 transition-colors hover:border-danger/40 hover:text-danger"
          >
            <LogOut size={12} /> sair
          </button>
        </div>

        {/* Mobile actions — notifications bell (rest lives in the bottom nav) */}
        <div className="flex items-center gap-1 lg:hidden">
          <NotificationsBell
            authed={authed}
            avatarByName={avatarByName}
            onOpenCard={openCardById}
            refreshSignal={notifSignal}
          />
        </div>
      </header>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bp-dots opacity-50" aria-hidden />

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-3 text-stone-500">
            <Spinner />
            <span className="font-mono text-sm">carregando pipeline…</span>
          </div>
        ) : error ? (
          <div className="m-auto flex max-w-md items-start gap-3 rounded-xl border border-danger/30 bg-danger/[0.06] p-6 text-danger">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Erro ao carregar</p>
              <p className="mt-1 font-mono text-xs text-danger/80">{error}</p>
              <p className="mt-3 text-xs text-stone-500">
                A API KV responde apenas no deploy (Pages Functions). Em dev local
                use <code className="text-stone-500">wrangler pages dev</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-1 overflow-hidden p-4 lg:gap-6 lg:p-6">
            {/* Desktop sidebar */}
            <div className="hidden lg:block">
              <Sidebar {...sidebarProps} onSelect={setActiveId} />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <TopBar
                title={activeClient ? activeClient.name : "Todos os Projetos"}
                titleColor={activeClient?.color}
                stats={stats}
                query={query}
                setQuery={setQuery}
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                requestsOnly={requestsOnly}
                setRequestsOnly={setRequestsOnly}
                requestCount={openRequestsScoped}
                saving={saving}
                onNew={() => setWizard({ mode: "create" })}
                searchRef={searchRef}
              />
              <Board
                cards={visibleCards}
                clients={clients}
                avatarByName={avatarByName}
                requestsOnly={requestsOnly}
                onEdit={openCard}
                onDelete={deleteCard}
                onQuickAdd={quickAdd}
                onMove={moveCard}
                onReorder={reorderCards}
                onReview={reviewCard}
                onReviewBulk={reviewCardsBulk}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink/10 bg-clay/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <button
          onClick={() => setRequestsOnly(false)}
          className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors ${
            !requestsOnly ? "font-semibold text-action" : "font-medium text-stone-500"
          }`}
        >
          <span
            className={`flex h-7 items-center justify-center rounded-full px-4 transition-colors ${
              !requestsOnly ? "bg-action/15" : ""
            }`}
          >
            <LayoutGrid size={20} />
          </span>
          Quadro
        </button>
        <button
          onClick={() => {
            setActiveId(null);
            setRequestsOnly(true);
          }}
          className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors ${
            requestsOnly ? "font-semibold text-warning" : "font-medium text-stone-500"
          }`}
        >
          <span
            className={`relative flex h-7 items-center justify-center rounded-full px-4 transition-colors ${
              requestsOnly ? "bg-warning/15" : ""
            }`}
          >
            <Package size={20} />
            {openRequestsGlobal > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[9px] font-bold text-clay">
                {openRequestsGlobal > 9 ? "9+" : openRequestsGlobal}
              </span>
            )}
          </span>
          Solicitações
        </button>
        <button
          onClick={() => setShowIntel(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-stone-500 transition-colors active:text-action"
        >
          <span className="flex h-7 items-center justify-center">
            <Sparkles size={20} />
          </span>
          Reuniões
        </button>
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-stone-500 transition-colors active:text-action"
        >
          <span className="flex h-7 items-center justify-center">
            <Avatar name={userName || userEmail} src={userAvatar} />
          </span>
          Perfil
        </button>
      </nav>

      {/* Mobile Perfil sheet */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-2xl bg-clay pb-[env(safe-area-inset-bottom)] shadow-2xl"
            >
              <div className="mx-auto mb-1 mt-2 h-1 w-10 rounded-full bg-ink/15" />
              {userEmail && (
                <button
                  onClick={() => {
                    setShowProfile(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 border-b border-ink/10 px-5 py-4 text-left transition-colors active:bg-ink/[0.04]"
                >
                  <Avatar name={userName || userEmail} src={userAvatar} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {userName || "Meu perfil"}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-stone-500">
                      {userEmail}
                    </span>
                  </span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setShowFetch(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm text-stone-700 transition-colors active:bg-ink/[0.04]"
                >
                  <Download size={16} className="text-action" /> Buscar reuniões
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setShowAdmin(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm text-stone-700 transition-colors active:bg-ink/[0.04]"
                >
                  <ShieldCheck size={16} className="text-action" /> Admin · acessos
                </button>
              )}
              <a
                href="https://tektone.com.br"
                className="flex w-full items-center gap-3 px-5 py-3.5 text-sm text-stone-700 transition-colors active:bg-ink/[0.04]"
              >
                ← tektone.com.br
              </a>
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 border-t border-ink/10 px-5 py-3.5 text-left text-sm text-danger transition-colors active:bg-danger/[0.06]"
              >
                <LogOut size={16} /> Sair
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile projects drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="absolute left-0 top-0 h-full w-72 max-w-[82%] overflow-y-auto bg-clay p-4 shadow-2xl"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold tracking-[0.2em] text-ink">
                  <LogoMark className="h-6 w-auto" /> TEKTONE
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>
              <Sidebar
                {...sidebarProps}
                onSelect={(id) => {
                  setActiveId(id);
                  setDrawerOpen(false);
                }}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && (
          <CardModal
            card={editing}
            clients={clients}
            members={members}
            avatarByName={avatarByName}
            currentUser={{ email: userEmail, name: userName, avatar: userAvatar }}
            isAdmin={isAdmin}
            onSave={saveCard}
            onDelete={deleteCard}
            onClose={() => setEditing(null)}
            onCardUpdated={(serverCard) => {
              setCards((p) => p.map((c) => (c.id === serverCard.id ? serverCard : c)));
              bumpNotifs();
            }}
            onLaunchWizard={(liveCardState) => {
              setEditing(null);
              setWizard({ mode: "backfill", card: liveCardState });
            }}
          />
        )}
        {wizard && (
          <TaskWizard
            mode={wizard.mode}
            card={wizard.card}
            seedDefaults={seedDefaults}
            members={members}
            clients={clients}
            avatarByName={avatarByName}
            onClose={() => {
              const backTo = wizard.mode === "backfill" ? wizard.card : null;
              setWizard(null);
              if (backTo) setEditing(backTo);
            }}
            onCreated={(card) => {
              setCards((p) => [...p, card]);
              setWizard(null);
              setEditing(card);
            }}
            onUpdated={(card) => {
              setCards((p) => p.map((c) => (c.id === card.id ? card : c)));
              setWizard(null);
              setEditing(card);
              bumpNotifs();
            }}
          />
        )}
        {showAdmin && (
          <AdminPanel currentEmail={userEmail} onClose={() => setShowAdmin(false)} />
        )}
        {showFetch && (
          <MeetingFetch onClose={() => setShowFetch(false)} onDone={loadData} />
        )}
        {reviews.length > 0 && !editing && !showProfile && !showAdmin && (
          <ReviewPopup
            reviews={reviews}
            cards={cards}
            avatarByName={avatarByName}
            activeId={reviewActiveId}
            onActiveChange={setReviewActiveId}
            onClose={() => setReviews([])}
            onAck={ackReviews}
            onAckOne={ackOneReview}
            onEditTask={openCard}
            onDismissTask={deleteCard}
          />
        )}
        {showIntel && (
          <MeetingIntelligence
            clients={clients}
            members={members}
            avatarByName={avatarByName}
            isAdmin={isAdmin}
            onClose={() => setShowIntel(false)}
            onSaved={loadData}
          />
        )}
        {showProfile && (
          <ProfilePage
            onClose={() => setShowProfile(false)}
            onSaved={(prof) => {
              setUserName(prof.name);
              setUserAvatar(prof.avatar);
              setDirectory((prev) => {
                const others = prev.filter((u) => u.email !== prof.email);
                return [...others, { email: prof.email, name: prof.name, avatar: prof.avatar }];
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
