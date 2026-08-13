/**
 * JS twin of marketing/components/MarkdownBody.tsx — same Vite/Tailwind
 * workspace as BlogPanel.jsx, can't cross-import a .tsx from the separate
 * `marketing/` Next.js app, so the parsing rules are duplicated here for
 * the blog editor's live preview pane. MUST stay in lockstep with the
 * .tsx original: same block/inline subset, same behavior — see that
 * file's header comment for the full "what's supported / what isn't"
 * rundown and the reasoning (AI drafting prompt + Milkdown/Crepe editor
 * config in BlogPanel.jsx together only ever produce this subset).
 * Visual output doesn't need to be pixel-identical (different Tailwind
 * setup/fonts between the two apps) — just structurally/semantically the
 * same: same headings, same list/paragraph/image treatment.
 */

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const EMAIL_ONLY_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

function renderInline(text) {
  return text.split(INLINE_RE).map((part, i) => {
    if (!part) return null;
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (EMAIL_ONLY_RE.test(part)) {
      return (
        <a key={i} href={`mailto:${part}`} className="text-action underline hover:text-action/80">
          {part}
        </a>
      );
    }
    return part;
  });
}

// Same "media/<r2-key>" convention as the .tsx twin (see
// worker/lib/blogService.js's generateInlineImage / BlogPanel.jsx's
// "gerar imagem" insert) — resolved relative to this app's own /hub
// origin instead of the cross-domain absolute URL the marketing app
// needs, since this preview renders inside the hub itself.
function resolveImageSrc(src) {
  if (/^https?:\/\//.test(src)) return src;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/api/blog/${src}`;
}

export default function MarkdownBody({ content }) {
  const blocks = (content || "").split(/\n\n+/).filter(Boolean);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-bold tracking-tight text-ink">
              {trimmed.slice(4)}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="text-lg font-bold tracking-tight text-ink">
              {trimmed.slice(3)}
            </h2>
          );
        }
        const imgMatch = trimmed.match(IMAGE_RE);
        if (imgMatch) {
          const [, alt, src] = imgMatch;
          return (
            <img
              key={i}
              src={resolveImageSrc(src)}
              alt={alt}
              loading="lazy"
              className="w-full rounded-xl"
            />
          );
        }
        const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1 && lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-pretty leading-relaxed text-stone-600">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-pretty leading-relaxed text-stone-600">
            {renderInline(lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
