import MarkdownBody from "@/components/MarkdownBody";

export const key = "richtext";
export const label = "Texto";
export const category = "Conteúdo";

export const schema = [
  { key: "markdown", label: "Markdown", type: "markdown" },
];

export const defaultProps = { markdown: "" };

export function Render({ props }) {
  return <MarkdownBody content={props.markdown} />;
}
