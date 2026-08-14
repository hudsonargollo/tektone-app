import { useRef, useState } from "react";
import { Bold, Italic, Link2, Image as ImageIcon } from "lucide-react";
import MarkdownBody from "@/components/MarkdownBody";

const SNIPPETS = [
  { icon: Bold, label: "negrito", wrap: ["**", "**"] },
  { icon: Italic, label: "itálico", wrap: ["*", "*"] },
  { icon: Link2, label: "link", wrap: ["[", "](url)"] },
  { icon: ImageIcon, label: "imagem", wrap: ["![", "](url)"] },
];

// The `richtext` block's editor — a plain textarea + a preview rendered
// through the exact same MarkdownBody component the public site publishes
// through, so what's shown while editing is what ships. Replaces Milkdown;
// see ~/.claude/plans/tektone-block-builder.md section 2 for the rationale.
export default function RichtextEditor({ value, onChange }) {
  const [tab, setTab] = useState("editar");
  const textareaRef = useRef(null);

  function insertSnippet([before, after]) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = selectionStart + before.length + selected.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {["editar", "preview"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-t-lg px-3 py-1.5 font-mono text-[11px] transition-colors ${
                tab === key ? "border-b-2 border-action text-action" : "text-stone-500"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        {tab === "editar" && (
          <div className="flex gap-1">
            {SNIPPETS.map(({ icon: Icon, label, wrap }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={() => insertSnippet(wrap)}
                className="rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink"
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "editar" ? (
        <textarea
          ref={textareaRef}
          rows={14}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 font-mono text-sm text-ink"
        />
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-ink/15 surface-3 p-4">
          <MarkdownBody content={value} />
        </div>
      )}
    </div>
  );
}
