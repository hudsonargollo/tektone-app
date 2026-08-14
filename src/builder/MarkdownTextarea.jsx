import { forwardRef, useImperativeHandle, useRef } from "react";
import { Bold, Italic, Link2, Image as ImageIcon } from "lucide-react";

const SNIPPETS = [
  { icon: Bold, label: "negrito", wrap: ["**", "**"] },
  { icon: Italic, label: "itálico", wrap: ["*", "*"] },
  { icon: Link2, label: "link", wrap: ["[", "](url)"] },
  { icon: ImageIcon, label: "imagem", wrap: ["![", "](url)"] },
];

// Plain markdown textarea + a thin formatting toolbar (insert-snippet-at-
// cursor, GitHub-comment-box style) — the actual reusable primitive behind
// both RichtextEditor.jsx (the builder's own editar/preview tabs) and
// BlogPanel.jsx's Posts editor (which already owns its own outer editar/
// preview tabs, so it uses this directly rather than nesting a second tab
// pair inside). Exposes insertImage(key, alt) via ref — same shape
// MilkdownEditor used to expose, for BlogPanel's "gerar imagem" flow.
const MarkdownTextarea = forwardRef(function MarkdownTextarea({ value, onChange, rows = 14 }, ref) {
  const textareaRef = useRef(null);

  function insertAtCursor(before, after, selectedOverride) {
    const el = textareaRef.current;
    const current = value || "";
    if (!el) {
      onChange(`${current}\n\n${before}${selectedOverride ?? ""}${after}\n\n`);
      return;
    }
    const { selectionStart, selectionEnd } = el;
    const selected = selectedOverride ?? current.slice(selectionStart, selectionEnd);
    const next = current.slice(0, selectionStart) + before + selected + after + current.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = selectionStart + before.length + selected.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  useImperativeHandle(ref, () => ({
    // `key` is the bare R2 key (e.g. "posts/<id>/<uid>.png") — stored as
    // "media/<key>", the same portable form MarkdownBody's resolveImageSrc
    // expects (see src/components/MarkdownBody.jsx).
    insertImage(key, alt = "") {
      insertAtCursor("![" + alt + "](", ")", `media/${key}`);
    },
  }));

  return (
    <div>
      <div className="mb-1 flex justify-end gap-1">
        {SNIPPETS.map(({ icon: Icon, label, wrap }) => (
          <button
            key={label}
            type="button"
            title={label}
            onClick={() => insertAtCursor(wrap[0], wrap[1])}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink"
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 font-mono text-sm text-ink"
      />
    </div>
  );
});

export default MarkdownTextarea;
