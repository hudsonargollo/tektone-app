import { forwardRef, useState } from "react";
import MarkdownBody from "@/components/MarkdownBody";
import MarkdownTextarea from "./MarkdownTextarea";

// The `richtext` block's editor — editar/preview tabs wrapping
// MarkdownTextarea, previewed through the exact same MarkdownBody
// component the public site publishes through, so what's shown while
// editing is what ships. Replaces Milkdown; see
// ~/.claude/plans/tektone-block-builder.md section 2 for the rationale.
const RichtextEditor = forwardRef(function RichtextEditor({ value, onChange }, ref) {
  const [tab, setTab] = useState("editar");

  return (
    <div>
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

      {tab === "editar" ? (
        <MarkdownTextarea ref={ref} value={value} onChange={onChange} />
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-ink/15 surface-3 p-4">
          <MarkdownBody content={value} />
        </div>
      )}
    </div>
  );
});

export default RichtextEditor;
