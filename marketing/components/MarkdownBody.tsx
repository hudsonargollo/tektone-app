/**
 * Deliberately minimal — the AI drafting prompt only ever produces
 * paragraphs (with bold/italic), ## / ### subheadings, "- " bullet lists,
 * and, via the hub's Milkdown editor, `![alt](src)` image blocks (see
 * worker/lib/blogService.js's generation prompt and
 * src/components/BlogPanel.jsx's editor), so a full markdown library would
 * be more dependency than the actual content shape needs. Also used for
 * the legal pages (termos-de-uso, politica-de-privacidade), whose source
 * copy is list-heavy — hence the "- " bullet handling below.
 *
 * Kept in lockstep with src/components/MarkdownBody.jsx (the hub app's JS
 * twin — separate Vite workspace, can't cross-import this .tsx — used for
 * the blog editor's live preview pane). Both recognize exactly this
 * subset, no more:
 *   - ## / ### headings (no # or ####+)
 *   - paragraphs with inline **bold** / *italic* (plain CommonMark syntax)
 *   - "- " bullet lists
 *   - ![alt](src) image blocks, alone on their own block
 * Explicitly NOT supported: ordered lists, tables, code blocks,
 * blockquotes, strikethrough, horizontal rules, and inline `[text](url)`
 * links — src/components/BlogPanel.jsx's Milkdown/Crepe config strips the
 * toolbar buttons and slash-menu entries for all of these, so authored
 * content shouldn't contain them, but this renderer just drops the raw
 * syntax as plain text rather than crashing if it ever does. See that
 * file's Crepe config comment for exactly what's locked down and what
 * isn't (input rules for typed markdown syntax can't be fully suppressed).
 *
 * No inline-link markdown syntax support (no `[text](url)`) — the only
 * inline link this content ever needs is a plain-text email mention
 * (e.g. "E-mail: Matrix@tektone.com.br" in the legal pages), so instead
 * of a real link parser, renderInline() auto-wraps anything email-shaped
 * in a mailto: link, alongside bold/italic handling.
 */

// One alternation covers **bold**, *italic*, and bare emails so a single
// split() pass tokenizes a line without the three concerns clobbering each
// other's matches — bold's `\*\*...\*\*` is listed before italic's
// `\*...\*` so left-to-right alternation prefers it at any `**` run.
const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const EMAIL_ONLY_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// A block is an image block only if it's *just* `![alt](src)` — an image
// mixed into running text isn't part of the supported subset and falls
// through to the paragraph branch (rendered as literal text) instead.
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

function renderInline(text: string) {
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
        <a key={i} href={`mailto:${part}`} className="text-green underline hover:text-green-hover">
          {part}
        </a>
      );
    }
    return part;
  });
}

// Inline image references are stored as the bare "media/<r2-key>" produced
// by worker/lib/blogService.js's generateInlineImage() (see
// functions/api/blog/[[path]].js's POST .../images route) — resolve that
// against the public blog media endpoint. Absolute URLs pass through
// unchanged (defensive; nothing generates one today). Kept identical to
// src/components/MarkdownBody.jsx's resolveImageSrc (different base: that
// one is relative to the hub's own origin, this one needs the full
// cross-app domain since marketing and the hub are separate deployments).
function resolveImageSrc(src: string) {
  if (/^https?:\/\//.test(src)) return src;
  return `https://tektone.com.br/hub/api/blog/${src}`;
}

export default function MarkdownBody({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/).filter(Boolean);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={i} className="text-lg font-bold tracking-tightish text-ink">
              {trimmed.slice(4)}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="text-xl font-bold tracking-tightish text-ink">
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
              className="w-full rounded-2xl"
            />
          );
        }
        const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1 && lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 text-pretty leading-relaxed text-ink/75">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-pretty leading-relaxed text-ink/75">
            {renderInline(lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
