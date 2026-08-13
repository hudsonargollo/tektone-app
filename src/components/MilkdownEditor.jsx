import { forwardRef, useImperativeHandle, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { editorViewCtx } from "@milkdown/kit/core";
import { replaceAll } from "@milkdown/kit/utils";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

/**
 * Milkdown/Crepe editor for the blog post body (see BlogPanel.jsx). Backed
 * by plain markdown in/out — parses `defaultValue` once on mount, reports
 * the current markdown string back via `onChange` on every edit — same
 * "one string" shape the old plain <textarea> had, so saveEdit()'s
 * `api.updateBlogPost(id, draft)` call needed no changes.
 *
 * Schema lockdown: marketing/components/MarkdownBody.tsx (the ground-truth
 * public renderer) and its JS twin src/components/MarkdownBody.jsx only
 * support a narrow subset — ## / ### headings, bold/italic emphasis, "- "
 * bullets, ![alt](src) images — see that file's header comment for the
 * full list of what's deliberately excluded (ordered lists, tables, code
 * blocks, blockquotes, strikethrough, horizontal rules, inline links).
 * Crepe's actual document schema is the full commonmark+gfm preset —
 * CrepeBuilder's constructor hardcodes `.use(commonmark).use(gfm)`, and
 * the block-edit/toolbar feature modules import blockquote/hr/ordered-
 * list/strikethrough/link node schemas directly from those presets — so
 * there's no clean way to strip the node types themselves without forking
 * Crepe internals. What IS locked down here is every UI entry point:
 *   - Table / CodeMirror / Latex / LinkTooltip features disabled outright
 *     (no toolbar button, no slash-menu entry, no tooltip)
 *   - ImageBlock feature disabled too — the only supported way to add an
 *     image is the "gerar imagem" AI button (BlogPanel.jsx), which calls
 *     insertImage() below directly via ref, never Crepe's own upload UI
 *   - the slash ("/") menu's h1/h4/h5/h6/quote/divider/ordered-list/
 *     task-list entries are removed via featureConfigs nulling
 *   - the selection toolbar's strikethrough/inline-code/link buttons are
 *     stripped via buildToolbar (Crepe's GroupBuilder has no per-item
 *     "remove" — this filters the group's live items array directly,
 *     which is the officially exposed customization hook, just used more
 *     bluntly than a single documented option)
 * Not covered: typing raw markdown syntax by hand (e.g. "> " or "1. " or
 * "```") still triggers ProseMirror's built-in input rules, since those
 * are wired by the commonmark/gfm preset itself, not gated by Crepe
 * feature flags. That's a real gap — MarkdownBody just renders whatever
 * slips through as inert text/asterisks rather than crashing, so nothing
 * breaks, but it isn't airtight enforcement.
 */
// Stored/PATCHed markdown keeps image refs in the bare "media/<r2-key>"
// form (see worker/lib/blogService.js's generateInlineImage / the
// MarkdownBody twins' resolveImageSrc) — a portable reference each
// consumer resolves against its own API base. But `<img src="media/x">`
// inside the live Milkdown/ProseMirror canvas resolves as a browser-
// relative URL against the current page path, which is wrong (and,
// depending on the exact pathname, often just broken) — so the editor
// needs the fully-resolved URL for a working live preview. These two
// helpers translate at the editor's boundary only: resolved going in
// (defaultValue → Crepe) and shortened going back out (markdownUpdated →
// onChange/draft.content), so what's actually persisted/PATCHed never
// changes shape.
const MEDIA_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/blog/media/`;
function resolveMediaRefs(markdown) {
  return markdown.replace(/(!\[[^\]]*\]\()media\/([^)\s]+)(\))/g, (_m, pre, key, post) => `${pre}${MEDIA_BASE}${key}${post}`);
}
function shortenMediaRefs(markdown) {
  return markdown.split(MEDIA_BASE).join("media/");
}

const InnerEditor = forwardRef(function InnerEditor({ defaultValue, onChange }, ref) {
  const crepeRef = useRef(null);

  const { loading } = useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: resolveMediaRefs(defaultValue || ""),
      features: {
        [Crepe.Feature.Table]: false,
        [Crepe.Feature.CodeMirror]: false,
        [Crepe.Feature.Latex]: false,
        [Crepe.Feature.LinkTooltip]: false,
        [Crepe.Feature.ImageBlock]: false,
      },
      featureConfigs: {
        [Crepe.Feature.BlockEdit]: {
          textGroup: { h1: null, h4: null, h5: null, h6: null, quote: null, divider: null },
          listGroup: { orderedList: null, taskList: null },
          advancedGroup: { codeBlock: null },
        },
        [Crepe.Feature.Toolbar]: {
          buildToolbar: (builder) => {
            const formatting = builder.getGroup("formatting");
            formatting.group.items = formatting.group.items.filter((item) => item.key !== "strikethrough");
            const fn = builder.getGroup("function");
            fn.group.items = fn.group.items.filter((item) => item.key !== "code" && item.key !== "link");
          },
        },
      },
    });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) onChange?.(shortenMediaRefs(markdown));
      });
    });
    crepeRef.current = crepe;
    return crepe;
  }, []);

  useImperativeHandle(ref, () => ({
    // Inserts an image node at the current cursor position, given the R2
    // key from generateInlineImage() — resolves it to a real URL for the
    // live canvas (see resolveMediaRefs above). Falls back to appending a
    // markdown image block at the end of the document if the cursor-based
    // ProseMirror insert can't run for some reason (e.g. the editor isn't
    // focused/ready yet) — never silently drops the image.
    insertImage(key, alt = "") {
      const crepe = crepeRef.current;
      if (!crepe) return;
      const src = `${MEDIA_BASE}${key}`;
      try {
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;
          const { schema } = state;
          const imageType = schema.nodes.image;
          const paragraphType = schema.nodes.paragraph;
          const imageNode = imageType?.createAndFill({ src, alt });
          if (!imageNode || !paragraphType) throw new Error("image/paragraph node schema unavailable");
          // Wrap in its own paragraph and insert as a new block sibling
          // (after the top-level block the cursor is in) rather than
          // `replaceSelectionWith` — `image` is an inline node in the
          // commonmark schema, so inserting it directly into the current
          // text flow fuses it onto whatever text precedes the cursor
          // with no blank-line separator once serialized to markdown.
          // Both MarkdownBody renderers require an image to be alone on
          // its own block to recognize it as an image (see IMAGE_RE) —
          // fused text falls through to the paragraph branch instead and
          // renders as literal `![]()` text.
          const blockNode = paragraphType.create(null, imageNode);
          const insertPos = state.selection.$to.after(1);
          view.dispatch(state.tr.insert(insertPos, blockNode));
          view.focus();
        });
      } catch {
        const current = crepe.getMarkdown();
        crepe.editor.action(replaceAll(`${current}\n\n![${alt}](${src})\n\n`));
      }
    },
  }));

  return <Milkdown />;
});

export default forwardRef(function MilkdownEditor(props, ref) {
  return (
    <MilkdownProvider>
      <InnerEditor {...props} ref={ref} />
    </MilkdownProvider>
  );
});
