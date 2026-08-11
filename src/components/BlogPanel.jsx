import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Newspaper, Check, Ban, Sparkles, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const STATUS_LABEL = {
  pending_review: "aguardando revisão",
  published: "publicado",
  rejected: "rejeitado",
};

export default function BlogPanel({ onClose }) {
  const [tab, setTab] = useState("pending_review");
  const [posts, setPosts] = useState(null);
  const [editing, setEditing] = useState(null); // post being edited, or null
  const [draft, setDraft] = useState({ title: "", excerpt: "", content: "" });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  function load() {
    api.listBlogPosts(tab).then(({ posts }) => setPosts(posts)).catch((e) => setError(e.body?.error || "Falha ao carregar."));
  }
  useEffect(load, [tab]);

  function startEdit(post) {
    setEditing(post.id);
    setDraft({ title: post.title, excerpt: post.excerpt || "", content: post.content });
  }

  async function saveEdit(id) {
    setBusy(id);
    setError("");
    try {
      await api.updateBlogPost(id, draft);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar.");
    } finally {
      setBusy(null);
    }
  }

  async function approve(id) {
    setBusy(id);
    setError("");
    try {
      await api.approveBlogPost(id);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao publicar.");
    } finally {
      setBusy(null);
    }
  }

  async function reject(id) {
    const reason = window.prompt("Motivo da rejeição (opcional):") || "";
    setBusy(id);
    setError("");
    try {
      await api.rejectBlogPost(id, reason);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao rejeitar.");
    } finally {
      setBusy(null);
    }
  }

  async function generateNow() {
    setGenerating(true);
    setError("");
    try {
      await api.generateBlogDrafts();
      if (tab === "pending_review") load();
      else setTab("pending_review");
    } catch (e) {
      setError(e.body?.error || "Falha ao gerar rascunhos.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
          <div className="flex items-center gap-2">
            <Newspaper size={15} className="text-action" />
            <span className="label-tech">Blog</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateNow}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 transition-colors hover:border-action/40 hover:text-action disabled:opacity-50"
            >
              {generating ? <Spinner /> : <Sparkles size={12} />} gerar agora
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-ink/15 px-6 pt-3">
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-t-lg px-3 py-2 font-mono text-[11px] transition-colors ${
                tab === key ? "border-b-2 border-action text-action" : "text-stone-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}

          {!posts ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhum artigo aqui.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <div key={p.id} className="rounded-xl surface-3 p-4">
                  {editing === p.id ? (
                    <div className="space-y-2">
                      <input
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm font-semibold text-ink"
                      />
                      <input
                        value={draft.excerpt}
                        onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                        placeholder="Resumo"
                        className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                      />
                      <textarea
                        value={draft.content}
                        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                        rows={10}
                        className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 font-mono text-xs text-ink"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={busy === p.id}
                          className="rounded-lg bg-action px-3 py-1.5 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
                        >
                          salvar
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded-lg surface-2 px-3 py-1.5 font-mono text-[11px] text-stone-500"
                        >
                          cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">{p.pillar_name}</p>
                          <p className="truncate font-semibold text-ink">{p.title}</p>
                        </div>
                        {p.cover_illustration && (
                          <img
                            src={`/api/blog/media/${p.cover_illustration}`}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-lg object-cover"
                          />
                        )}
                      </div>
                      {p.excerpt && <p className="mb-3 text-sm text-stone-600">{p.excerpt}</p>}
                      {tab === "pending_review" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(p.id)}
                            disabled={busy === p.id}
                            className="flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
                          >
                            {busy === p.id ? <Spinner /> : <Check size={12} />} publicar
                          </button>
                          <button
                            onClick={() => startEdit(p)}
                            className="flex items-center gap-1.5 rounded-lg surface-2 px-3 py-1.5 font-mono text-[11px] text-stone-600"
                          >
                            <Pencil size={12} /> editar
                          </button>
                          <button
                            onClick={() => reject(p.id)}
                            disabled={busy === p.id}
                            className="flex items-center gap-1.5 rounded-lg surface-2 px-3 py-1.5 font-mono text-[11px] text-danger disabled:opacity-50"
                          >
                            <Ban size={12} /> rejeitar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
