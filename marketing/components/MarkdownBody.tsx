/**
 * Deliberately minimal — the AI drafting prompt only ever produces
 * paragraphs and ## / ### subheadings (see worker/lib/blogService.js's
 * generation prompt), so a full markdown library would be more dependency
 * than the actual content shape needs. Also used for the legal pages
 * (termos-de-uso, politica-de-privacidade), whose source copy is
 * list-heavy — hence the "- " bullet handling below.
 *
 * No inline-link markdown syntax support (no `[text](url)`) — the only
 * inline link this content ever needs is a plain-text email mention
 * (e.g. "E-mail: Matrix@tektone.com.br" in the legal pages), so instead
 * of adding a real markdown parser, `linkifyEmails` auto-wraps anything
 * email-shaped in a mailto: link and leaves everything else untouched.
 */
const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

function linkifyEmails(text: string) {
  const parts = text.split(EMAIL_RE);
  return parts.map((part, i) =>
    EMAIL_RE.test(part) ? (
      <a key={i} href={`mailto:${part}`} className="text-green underline hover:text-green-hover">
        {part}
      </a>
    ) : (
      part
    )
  );
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
        const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1 && lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 text-pretty leading-relaxed text-ink/75">
              {lines.map((l, j) => (
                <li key={j}>{linkifyEmails(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-pretty leading-relaxed text-ink/75">
            {linkifyEmails(lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
