import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Instagram, Download, Trash2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

// AI Instagram Post Generator (PRD, 2026-08-12) — a guided form (not a
// blank textbox, per the PRD's "Guided Prompt Interface") that generates
// a brand-constrained image via Workers AI SDXL, then a canvas
// post-processing step applies brand tokens (optional watermark, no
// glow/neon/halo per the Mineral System's hard constraint — see
// docs/BRAND_VISUAL_SYSTEM.md) before export. Backend: functions/api/social/[[path]].js.
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const imageUrl = (id) => `${API_BASE}/api/social/${id}/image`;

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

const ASPECT_RATIOS = [
  { value: "1080x1080", label: "1080 × 1080 (feed)" },
  { value: "1080x1350", label: "1080 × 1350 (retrato)" },
];

// Same 3-layer construction as LogoMark.jsx (Architrave/Pillar/Foundation),
// duplicated as a raw SVG string here since canvas needs a data URL, not a
// mounted React component.
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 116">
  <rect x="15" y="18" width="70" height="22" fill="#C7B79C"/>
  <rect x="18" y="21" width="64" height="16" fill="#141618"/>
  <rect x="42" y="37" width="16" height="58" fill="#2E4A43"/>
  <rect x="45" y="37" width="10" height="56" fill="#141618"/>
  <rect x="49.2" y="41" width="1.6" height="46" fill="#C7B79C"/>
  <rect x="38" y="95" width="24" height="5" fill="#C7B79C"/>
  <rect x="33" y="100" width="34" height="4" fill="#141618"/>
  <rect x="26" y="106.5" width="48" height="1.8" fill="#141618"/>
  <rect x="21" y="110.5" width="58" height="1.2" fill="#C7B79C"/>
</svg>`;

export default function SocialPostGenerator({ onClose }) {
  const [objective, setObjective] = useState("autoridade");
  const [subject, setSubject] = useState("");
  const [visualTone, setVisualTone] = useState(VISUAL_TONES[0]);
  const [aspectRatio, setAspectRatio] = useState("1080x1080");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { id, masterPrompt, aspectRatio }
  const [showWatermark, setShowWatermark] = useState(true);
  const [caption, setCaption] = useState("");

  const [gallery, setGallery] = useState(null);
  const [galleryError, setGalleryError] = useState("");

  const canvasRef = useRef(null);

  function loadGallery() {
    api
      .listSocialPosts()
      .then(({ posts }) => setGallery(posts))
      .catch(() => setGalleryError("Não foi possível carregar a galeria."));
  }

  useEffect(() => {
    loadGallery();
  }, []);

  async function handleGenerate(e) {
    e.preventDefault();
    if (!subject.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const { post } = await api.generateSocialPost({ objective, subject: subject.trim(), visualTone, aspectRatio });
      setResult(post);
      loadGallery();
    } catch (err) {
      setError(err?.body?.error || "Falha ao gerar a imagem.");
    } finally {
      setGenerating(false);
    }
  }

  // Draws the generated image + brand-token overlays onto the canvas.
  // No glow/shadow/neon anywhere here — hard constraint from the live
  // /brand guide (see docs/BRAND_VISUAL_SYSTEM.md).
  useEffect(() => {
    if (!result) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [w, h] = result.aspectRatio.split("x").map(Number);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    // Every keystroke in the caption field re-runs this effect, each
    // creating a fresh Image() load — completion order across overlapping
    // loads isn't guaranteed, so without this guard a stale (shorter)
    // caption's onload can resolve after the current one and silently
    // overwrite the canvas with outdated text (caught via live testing:
    // typing a full sentence rendered only its first two words because an
    // earlier keystroke's load callback won the race).
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      // object-cover fit
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

      if (caption.trim()) {
        ctx.fillStyle = "rgba(20,22,24,0.55)";
        const bandH = Math.round(h * 0.16);
        ctx.fillRect(0, h - bandH, w, bandH);
        ctx.fillStyle = "#EFE8DC";
        ctx.font = `italic ${Math.round(w * 0.032)}px "EB Garamond", Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        wrapText(ctx, caption.trim(), w / 2, h - bandH / 2, w * 0.86, Math.round(w * 0.04));
      }

      if (showWatermark) {
        const markSize = Math.round(w * 0.09);
        const markImg = new Image();
        markImg.onload = () => {
          if (cancelled) return;
          const pad = Math.round(w * 0.035);
          const mh = markSize * 1.16;
          ctx.drawImage(markImg, w - markSize - pad, h - mh - pad, markSize, mh);
        };
        markImg.src = `data:image/svg+xml;base64,${btoa(MARK_SVG)}`;
      }
    };
    img.src = imageUrl(result.id);

    return () => {
      cancelled = true;
    };
  }, [result, showWatermark, caption]);

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  }

  async function handleExport() {
    if (!result || !canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tektone-post-${result.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
      try {
        await api.exportSocialPost(result.id);
        loadGallery();
      } catch {
        /* export still succeeded locally even if the status flag fails */
      }
    }, "image/png");
  }

  async function handleDelete(id) {
    try {
      await api.deleteSocialPost(id);
      loadGallery();
      if (result?.id === id) setResult(null);
    } catch {
      setGalleryError("Não foi possível remover.");
    }
  }

  return (
    <div className="flex h-full flex-col surface-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
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

              <div>
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

              <div className="sm:col-span-2">
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

              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                  Formato
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none focus:border-action"
                >
                  {ASPECT_RATIOS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-3 font-mono text-[11px] text-danger">{error}</p>}

            <button
              type="submit"
              disabled={generating || !subject.trim()}
              className="mt-4 flex items-center gap-2 rounded-lg bg-action px-5 py-2.5 text-sm font-bold text-clay transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? (
                <>
                  <Spinner className="h-4 w-4" /> Gerando… (pode levar até 30s)
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Gerar imagem
                </>
              )}
            </button>
          </form>

          {/* ── Result + canvas overlay ─────────────────────────────── */}
          {result && (
            <div className="rounded-xl surface-3 p-5">
              <p className="label-tech mb-4">Resultado</p>
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="mx-auto max-w-xs shrink-0 overflow-hidden rounded-lg border border-ink/10">
                  <canvas ref={canvasRef} className="block w-full" />
                </div>
                <div className="flex-1 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={showWatermark}
                      onChange={(e) => setShowWatermark(e.target.checked)}
                    />
                    Aplicar marca Tektone (watermark)
                  </label>
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-stone-500">
                      Legenda sobreposta (opcional)
                    </label>
                    <input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="curta, no tom editorial da marca"
                      className="w-full rounded-lg border border-ink/15 bg-clay px-3 py-2 text-sm text-ink outline-none placeholder:text-stone-400 focus:border-action"
                    />
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.05]"
                  >
                    <Download size={15} /> Exportar PNG
                  </button>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[10px] text-stone-500">
                      ver prompt usado
                    </summary>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">{result.masterPrompt}</p>
                  </details>
                </div>
              </div>
            </div>
          )}

          {/* ── Gallery ──────────────────────────────────────────────── */}
          <div>
            <p className="label-tech mb-3">Galeria</p>
            {galleryError && <p className="mb-2 font-mono text-[11px] text-danger">{galleryError}</p>}
            {!gallery ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : gallery.length === 0 ? (
              <p className="text-sm text-stone-500">Nenhum post gerado ainda.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {gallery.map((p) => (
                  <div key={p.id} className="group relative overflow-hidden rounded-lg border border-ink/10">
                    <img src={imageUrl(p.id)} alt="" className="aspect-square w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/70 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="font-mono text-[9px] uppercase text-clay">
                        {p.status === "exported" ? "exportado" : "rascunho"}
                      </span>
                      <button onClick={() => handleDelete(p.id)} className="text-clay hover:text-danger">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
