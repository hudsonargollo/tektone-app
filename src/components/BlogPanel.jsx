import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Newspaper, Check, Ban, Sparkles, Pencil, ImagePlus } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import MilkdownEditor from "@/components/MilkdownEditor";
import MarkdownBody from "@/components/MarkdownBody";
import DocumentBuilder from "@/builder/DocumentBuilder";

const CONTENT_TABS = [
  { key: "posts", label: "Posts" },
  { key: "page", label: "Páginas" },
  { key: "form", label: "Formulários" },
  { key: "quiz", label: "Quizzes" },
];

const STATUS_LABEL = {
  pending_review: "aguardando revisão",
  published: "publicado",
  rejected: "rejeitado",
};

export default function BlogPanel({ onClose }) {
  const [contentTab, setContentTab] = useState("posts");
  const [tab, setTab] = useState("pending_review");
  const [posts, setPosts] = useState(null);
  const [editing, setEditing] = useState(null); // post being edited, or null
  const [draft, setDraft] = useState({ title: "", excerpt: "", content: "" });
  const [editorTab, setEditorTab] = useState("editar"); // "editar" | "preview"
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const milkdownRef = useRef(null);
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
    setEditorTab("editar");
    setImgPrompt("");
  }

  async function insertGeneratedImage(postId) {
    const prompt = imgPrompt.trim();
    if (!prompt) return;
    setImgBusy(true);
    setError("");
    try {
      const { key } = await api.generateBlogImage(postId, prompt);
      milkdownRef.current?.insertImage(key, "");
      setImgPrompt("");
    } catch (e) {
      setError(e.body?.error || "Falha ao gerar imagem.");
    } finally {
      setImgBusy(false);
    }
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
    <div className="flex h-full w-full flex-col surface-2">
      <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="-ml-1.5 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink lg:hidden"
          >
            <ArrowLeft size={16} />
          </button>
          <Newspaper size={15} className="text-action" />
          <span className="label-tech">Blog</span>
          <div className="ml-4 flex gap-1">
            {CONTENT_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setContentTab(t.key)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  contentTab === t.key ? "bg-action/10 text-action" : "text-stone-500 hover:bg-ink/[0.04]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {contentTab === "posts" && (
          <button
            onClick={generateNow}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 transition-colors hover:border-action/40 hover:text-action disabled:opacity-50"
          >
            {generating ? <Spinner /> : <Sparkles size={12} />} gerar agora
          </button>
        )}
      </div>

      {contentTab === "page" || contentTab === "form" || contentTab === "quiz" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <DocumentBuilder
            kind={contentTab}
            newPlaceholder={
              {
                page: "Título da nova página…",
                form: "Título do novo formulário…",
                quiz: "Título do novo quiz…",
              }[contentTab]
            }
            emptyText={
              {
                page: "Nenhuma página criada ainda.",
                form: "Nenhum formulário criado ainda.",
                quiz: "Nenhum quiz criado ainda.",
              }[contentTab]
            }
          />
        </div>
      ) : (
        <>
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

        <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-5">
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

                      <div className="flex gap-1">
                        {["editar", "preview"].map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEditorTab(key)}
                            className={`rounded-t-lg px-3 py-1.5 font-mono text-[11px] transition-colors ${
                              editorTab === key ? "border-b-2 border-action text-action" : "text-stone-500"
                            }`}
                          >
                            {key}
                          </button>
                        ))}
                      </div>

                      <div className={editorTab === "editar" ? "space-y-2" : "hidden"}>
                        <div className="milkdown-shell rounded-lg border border-ink/15 bg-transparent px-2">
                          <MilkdownEditor
                            ref={milkdownRef}
                            defaultValue={draft.content}
                            onChange={(markdown) => setDraft((d) => ({ ...d, content: markdown }))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={imgPrompt}
                            onChange={(e) => setImgPrompt(e.target.value)}
                            placeholder="descreva a imagem para gerar…"
                            className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-1.5 text-xs text-ink"
                          />
                          <button
                            type="button"
                            onClick={() => insertGeneratedImage(p.id)}
                            disabled={imgBusy || !imgPrompt.trim()}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg surface-2 px-2.5 py-1.5 font-mono text-[11px] text-stone-600 disabled:opacity-50"
                          >
                            {imgBusy ? <Spinner /> : <ImagePlus size={12} />} gerar imagem
                          </button>
                        </div>
                      </div>

                      {editorTab === "preview" && (
                        <div className="max-h-[440px] overflow-y-auto rounded-lg border border-ink/15 surface-3 p-4">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                            {p.pillar_name}
                          </p>
                          <p className="mt-1 text-lg font-bold text-ink">{draft.title || "(sem título)"}</p>
                          {draft.excerpt && <p className="mt-2 text-sm text-stone-600">{draft.excerpt}</p>}
                          {p.cover_illustration && (
                            <img
                              src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/blog/media/${p.cover_illustration}`}
                              alt=""
                              className="mt-4 aspect-[4/3] w-full rounded-xl object-cover"
                            />
                          )}
                          <div className="mt-4">
                            <MarkdownBody content={draft.content} />
                          </div>
                        </div>
                      )}

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
                            src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/blog/media/${p.cover_illustration}`}
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
        </>
      )}
    </div>
  );
}
