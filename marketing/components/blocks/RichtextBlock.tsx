import MarkdownBody from "@/components/MarkdownBody";

interface RichtextProps {
  markdown?: string;
}

export function RichtextBlock({ props }: { props: RichtextProps }) {
  return <MarkdownBody content={props.markdown || ""} />;
}
