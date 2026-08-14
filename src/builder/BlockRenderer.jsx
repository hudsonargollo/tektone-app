import { BLOCK_REGISTRY } from "./registry";

// Renders an ordered array of {id, type, props} blocks. Used verbatim by
// both the builder's live canvas and the published document route — same
// component, same props, so what the editor shows is what ships.
export default function BlockRenderer({ blocks }) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-8">
      {blocks.map((block) => {
        const mod = BLOCK_REGISTRY[block.type];
        if (!mod) {
          return (
            <div key={block.id} className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              Tipo de bloco desconhecido: {block.type}
            </div>
          );
        }
        const { Render } = mod;
        return <Render key={block.id} props={block.props || {}} />;
      })}
    </div>
  );
}
