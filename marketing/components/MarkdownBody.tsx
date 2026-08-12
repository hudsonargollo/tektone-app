/**
 * Deliberately minimal — the AI drafting prompt only ever produces
 * paragraphs and ## / ### subheadings (see worker/lib/blogService.js's
 * generation prompt), so a full markdown library would be more dependency
 * than the actual content shape needs. Also used for the legal pages
 * (termos-de-uso, politica-de-privacidade), whose source copy is
 * list-heavy — hence the "- " bullet handling below.
 */
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
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-pretty leading-relaxed text-ink/75">
            {lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}
