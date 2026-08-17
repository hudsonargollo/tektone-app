import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Instagram, Download, Trash2, Sparkles, Plus, X, RefreshCw, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

// AI Instagram Post Generator (PRD, 2026-08-12) — a guided form (not a
// blank textbox, per the PRD's "Guided Prompt Interface") that generates
// brand-constrained image(s) via Workers AI SDXL plus a short, on-brand
// overlay caption via Claude (grounded in brand_kb voice + positioning —
// see socialPostService.js's generateCaption). Backend: functions/api/social/[[path]].js.
//
// Compositing (the caption band + Tektone watermark burned onto the raw
// SDXL image) moved server-side (see worker/lib/socialCompositor.js) so
// mobile doesn't need to duplicate this app's old <canvas> post-processing
// step with a heavy RN canvas dependency — both platforms now just display
// a finished PNG the server already composited. Editing the caption here
// PATCHes it to the server (which recomposites from the pristine raw
// image and overwrites the served PNG) instead of redrawing a local
// canvas — a network round trip on save, not live per-keystroke, but it's
// also a real fix: the old canvas version never actually persisted a
// hand-typed caption anywhere, so a reload silently lost your edit.
//
// Three formats (migration 0015 added carousel/story on top of the
// original feed-only generator):
// - feed: one image, feed aspect ratio (square or portrait).
// - story: one image, forced 1080x1920 — not user-selectable.
// - carousel: 2-8 images sharing one `groupId`, each with its own
//   subject/context so the slides can tell a sequence instead of
//   repeating the same picture. Generated in parallel server-side.
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
// `v` cache-busts the browser's cached PNG bytes after a recomposite
// (reroll or manual caption save) overwrites the same R2 key/URL.
const imageUrl = (id, v) => `${API_BASE}/api/social/${id}/image${v ? `?v=${v}` : ""}`;

const OBJECTIVES = [
  { value: "autoridade", label: "Autoridade" },
  { value: "conversao", label: "Conversão" },
  { value: "bastidores", label: "Bastidores" },
];

// Enforced dropdown (per PRD §5) instead of freeform text, so tone stays
// inside the Mineral palette rather than drifting to whatever a user types.
const VISUAL_TONES = [
  "Mineral Black + Ivory Clay, alto contraste",
  "Mineral Green como cor primária",
  "Sand & Ivory, tom quieto e claro",
  "Invertido sobre Mineral Green",
  "Invertido sobre Mineral Black",
];

const FORMATS = [
  { value: "feed", label: "Feed" },
  { value: "carousel", label: "Carrossel" },
  { value: "story", label: "Story" },
];

// Feed and carousel slides share the same two crop ratios — a story is
// always 1080x1920 and has no dropdown (see the format-conditional render
// below), matching the backend's FEED_ASPECT_RATIOS/STORY_ASPECT_RATIO.
const ASPECT_RATIOS = [
  { value: "1080x1080", label: "1080 × 1080 (quadrado)" },
  { value: "1080x1350", label: "1080 × 1350 (retrato)" },
];

const MIN_CAROUSEL_SLIDES = 2;
const MAX_CAROUSEL_SLIDES = 8;

export default function SocialPostGenerator({ onClose }) {
  const [postFormat, setPostFormat] = useState("feed");
  const [objective, setObjective] = useState("autoridade");
  const [subject, setSubject] = useState("");
  const [slides, setSlides] = useState(["", ""]); // carousel per-slide subjects
  const [visualTone, setVisualTone] = useState(VISUAL_TONES[0]);
  const [aspectRatio, setAspectRatio] = useState("1080x1080");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]); // posts from the last generation (1 for feed/story, N for carousel)
  const [groupId, setGroupId] = useState(null);
  const [captions, setCaptions] = useState({}); // postId -> overlay caption (AI-suggested, editable)
  const [captionVersion, setCaptionVersion] = useState({}); // postId -> cache-bust counter, bumped on every recomposite
  const [regeneratingCaption, setRegeneratingCaption] = useState(null); // postId currently rerolling, or null
  const [savingCaption, setSavingCaption] = useState(null); // postId currently saving a manual edit, or null

  const [gallery, setGallery] = useState(null);
  const [galleryError, setGalleryError] = useState("");

  function loadGallery() {
    api
      .listSocialPosts()
      .then(({ posts }) => setGallery(posts))
      .catch(() => setGalleryError("Não foi possível carregar a galeria."));
  }

  useEffect(() => {
    loadGallery();
  }, []);

  function updateSlide(index, value) {
    setSlides((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addSlide() {
    setSlides((prev) => (prev.length >= MAX_CAROUSEL_SLIDES ? prev : [...prev, ""]));
  }

  function removeSlide(index) {
    setSlides((prev) => (prev.length <= MIN_CAROUSEL_SLIDES ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleGenerate(e) {
    e.preventDefault();
    const body = { objective, visualTone, postFormat };
    if (postFormat === "carousel") {
      const trimmed = slides.map((s) => s.trim());
      if (trimmed.some((s) => !s)) return;
      body.subjects = trimmed;
      body.aspectRatio = aspectRatio;
    } else {
      if (!subject.trim()) return;
      body.subject = subject.trim();
      if (postFormat === "feed") body.aspectRatio = aspectRatio;
    }

    setGenerating(true);
    setError("");
    setResults([]);
    setGroupId(null);
    try {
      const { groupId: newGroupId, slides: newPosts } = await api.generateSocialPost(body);
      setResults(newPosts);
      setGroupId(newGroupId);
      setCaptions(Object.fromEntries(newPosts.map((p) => [p.id, p.caption || ""])));
      setCaptionVersion(Object.fromEntries(newPosts.map((p) => [p.id, 0])));
      loadGallery();
    } catch (err) {
      setError(err?.body?.error || "Falha ao gerar a imagem.");
    } finally {
      setGenerating(false);
    }
  }

  function bumpVersion(postId) {
    setCaptionVersion((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
  }

  async function handleRegenerateCaption(postId) {
    setRegeneratingCaption(postId);
    try {
      const { caption } = await api.regenerateSocialCaption(postId);
      setCaptions((prev) => ({ ...prev, [postId]: caption || "" }));
      bumpVersion(postId);
    } catch {
      /* keep the existing caption on failure */
    } finally {
      setRegeneratingCaption(null);
    }
  }

  async function handleSaveCaption(postId) {
    setSavingCaption(postId);
    try {
      await api.updateSocialCaption(postId, captions[postId] || "");
      bumpVersion(postId);
    } catch {
      setError("Não foi possível salvar a legenda.");
    } finally {
      setSavingCaption(null);
    }
  }

  function downloadResult(post, index) {
    const a = document.createElement("a");
    a.href = imageUrl(post.id, captionVersion[post.id]);
    a.download = results.length > 1 ? `tektone-post-${post.id}-slide${index + 1}.png` : `tektone-post-${post.id}.png`;
    a.click();
  }

  async function handleExportAll() {
    results.forEach((post, i) => downloadResult(post, i));
    try {
      if (groupId) await api.exportSocialPostGroup(groupId);
      else if (results[0]) await api.exportSocialPost(results[0].id);
      loadGallery();
    } catch {
      /* export still succeeded locally even if the status flag fails */
    }
  }

  const galleryItems = useMemo(() => {
    if (!gallery) return null;
    const items = [];
    const seenGroups = new Set();
    for (const p of gallery) {
      if (p.post_format === "carousel" && p.group_id) {
        if (seenGroups.has(p.group_id)) continue;
        seenGroups.add(p.group_id);
        const groupSlides = gallery
          .filter((g) => g.group_id === p.group_id)
          .sort((a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0));
        items.push({ kind: "carousel", groupId: p.group_id, slides: groupSlides });
      } else {
        items.push({ kind: "single", post: p });
      }
    }
    return items;
  }, [gallery]);

  async function handleDeleteItem(item) {
    try {
      if (item.kind === "carousel") {
        await api.deleteSocialPostGroup(item.groupId);
        if (groupId === item.groupId) {
          setResults([]);
          setGroupId(null);
        }
      } else {
        await api.deleteSocialPost(item.post.id);
        if (results.some((r) => r.id === item.post.id)) {
          setResults([]);
          setGroupId(null);
        }
      }
      loadGallery();
    } catch {
      setGalleryError("Não foi possível remover.");
    }
  }

  const canSubmit = postFormat === "carousel" ? slides.every((s) => s.trim()) : subject.trim().length > 0;

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
          <Instagram size={15} className="text-action" />
          <span className="label-tech">Posts</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* ── Guided Prompt Interface ─────────────────────────────── */}
          <form onSubmit={handleGenerate} className="rounded-xl surface-3 p-5">
            <p className="label-tech mb-4">Novo post</p>

            <div className="mb-4">
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                Formato
              </label>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setPostFormat(f.value)}
                    className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      postFormat === f.value
                        ? "border-action bg-action text-clay"
                        : "border-ink/15 text-ink hover:bg-ink/[0.05]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                    Objetivo
                  </label>
                  <select
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="w-full rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none focus:border-action"
                  >
                    {OBJECTIVES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                    Tom visual
                  </label>
                  <select
                    value={visualTone}
                    onChange={(e) => setVisualTone(e.target.value)}
                    className="w-full rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none focus:border-action"
                  >
                    {VISUAL_TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {postFormat !== "carousel" && (
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                    Assunto / contexto
                  </label>
                  <textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    rows={2}
                    placeholder="ex: fundador em call de diagnóstico com cliente, mesa de trabalho minimalista"
                    className="w-full resize-none rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none placeholder:text-stone-400 focus:border-action"
                  />
                </div>
              )}

              {postFormat === "feed" && (
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                    Proporção
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full max-w-sm rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none focus:border-action"
                  >
                    {ASPECT_RATIOS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {postFormat === "story" && (
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                    Proporção
                  </label>
                  <p className="max-w-sm rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-stone-500">
                    1080 × 1920 (fixo para story)
                  </p>
                </div>
              )}

              {postFormat === "carousel" && (
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                    Proporção (aplicada a todos os slides)
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none focus:border-action"
                  >
                    {ASPECT_RATIOS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {postFormat === "carousel" && (
              <div className="mt-4 space-y-3">
                <label className="block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                  Slides ({slides.length}/{MAX_CAROUSEL_SLIDES}) — cada um com seu próprio assunto/contexto
                </label>
                {slides.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-2 w-5 shrink-0 font-mono text-xs text-stone-400">{i + 1}.</span>
                    <textarea
                      value={s}
                      onChange={(e) => updateSlide(i, e.target.value)}
                      rows={1}
                      placeholder={`assunto/contexto do slide ${i + 1}`}
                      className="w-full resize-none rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none placeholder:text-stone-400 focus:border-action"
                    />
                    <button
                      type="button"
                      onClick={() => removeSlide(i)}
                      disabled={slides.length <= MIN_CAROUSEL_SLIDES}
                      className="mt-1 shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-ink/[0.05] hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSlide}
                  disabled={slides.length >= MAX_CAROUSEL_SLIDES}
                  className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-ink/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={13} /> Adicionar slide
                </button>
              </div>
            )}

            {error && <p className="mt-3 font-mono text-[11px] text-danger">{error}</p>}

            <button
              type="submit"
              disabled={generating || !canSubmit}
              className="mt-4 flex items-center gap-2 rounded-lg bg-action px-5 py-2.5 text-sm font-bold text-clay transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {postFormat === "carousel" ? "Gerando carrossel… (pode levar mais tempo)" : "Gerando… (pode levar até 30s)"}
                </>
              ) : (
                <>
                  <Sparkles size={15} /> {postFormat === "carousel" ? "Gerar carrossel" : "Gerar imagem"}
                </>
              )}
            </button>
          </form>

          {/* ── Result (server-composited image) ────────────────────── */}
          {results.length > 0 && (
            <div className="rounded-xl surface-3 p-5">
              <p className="label-tech mb-4">
                Resultado{results.length > 1 ? ` (${results.length} slides)` : ""}
              </p>

              <div className={results.length > 1 ? "flex gap-5 overflow-x-auto pb-2" : "flex flex-col gap-5 sm:flex-row"}>
                {results.map((post) => (
                  <div key={post.id} className={results.length > 1 ? "w-56 shrink-0 space-y-2" : "flex flex-1 flex-col gap-5 sm:flex-row"}>
                    <div className={results.length > 1 ? "overflow-hidden rounded-lg border border-ink/10" : "mx-auto max-w-xs shrink-0 overflow-hidden rounded-lg border border-ink/10"}>
                      <img src={imageUrl(post.id, captionVersion[post.id])} alt="" className="block w-full" />
                    </div>
                    <div className={results.length > 1 ? "space-y-2" : "flex-1 space-y-3"}>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="font-mono text-[10px] uppercase tracking-wide text-stone-500">
                            Legenda (sugerida pela IA, edite se quiser)
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRegenerateCaption(post.id)}
                            disabled={regeneratingCaption === post.id}
                            title="Sugerir outra legenda"
                            className="shrink-0 rounded p-1 text-stone-400 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <RefreshCw size={12} className={regeneratingCaption === post.id ? "animate-spin" : ""} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={captions[post.id] || ""}
                            onChange={(e) => setCaptions((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="sem legenda — a imagem fica só com a foto"
                            maxLength={90}
                            className="w-full rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none placeholder:text-stone-400 focus:border-action"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCaption(post.id)}
                            disabled={savingCaption === post.id}
                            title="Salvar legenda (recompõe a imagem)"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg surface-2 px-2.5 py-2 font-mono text-[11px] text-stone-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingCaption === post.id ? <Spinner /> : <Check size={13} />} salvar
                          </button>
                        </div>
                        <p className="mt-1 text-right font-mono text-[9px] text-stone-400">
                          {(captions[post.id] || "").length}/90 — quanto mais curta, melhor a leitura sobre a imagem
                        </p>
                      </div>
                      {results.length === 1 && (
                        <details>
                          <summary className="cursor-pointer font-mono text-[10px] text-stone-500">
                            ver prompt usado
                          </summary>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">{post.masterPrompt}</p>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleExportAll}
                className="mt-5 flex items-center gap-2 rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.05]"
              >
                <Download size={15} /> {results.length > 1 ? "Exportar todos os PNGs" : "Exportar PNG"}
              </button>
            </div>
          )}

          {/* ── Gallery ──────────────────────────────────────────────── */}
          <div>
            <p className="label-tech mb-3">Galeria</p>
            {galleryError && <p className="mb-2 font-mono text-[11px] text-danger">{galleryError}</p>}
            {!galleryItems ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : galleryItems.length === 0 ? (
              <p className="text-sm text-stone-500">Nenhum post gerado ainda.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {galleryItems.map((item) => {
                  const cover = item.kind === "carousel" ? item.slides[0] : item.post;
                  const status =
                    item.kind === "carousel"
                      ? item.slides.every((s) => s.status === "exported")
                        ? "exported"
                        : "draft"
                      : item.post.status;
                  return (
                    <div
                      key={item.kind === "carousel" ? item.groupId : item.post.id}
                      className="group relative overflow-hidden rounded-lg border border-ink/10"
                    >
                      <img
                        src={imageUrl(cover.id)}
                        alt=""
                        className={cover.aspect_ratio === "1080x1920" ? "aspect-[9/16] w-full object-cover" : "aspect-square w-full object-cover"}
                      />
                      {item.kind === "carousel" && (
                        <span className="absolute right-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] text-clay">
                          Carrossel · {item.slides.length}
                        </span>
                      )}
                      {item.kind === "single" && item.post.post_format === "story" && (
                        <span className="absolute right-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] text-clay">
                          Story
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/70 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="font-mono text-[9px] uppercase text-clay">
                          {status === "exported" ? "exportado" : "rascunho"}
                        </span>
                        <button onClick={() => handleDeleteItem(item)} className="text-clay hover:text-danger">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
