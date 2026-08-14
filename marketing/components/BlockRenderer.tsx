import { HeroBlock } from "@/components/blocks/HeroBlock";
import { RichtextBlock } from "@/components/blocks/RichtextBlock";
import { FeatureGridBlock } from "@/components/blocks/FeatureGridBlock";
import { TestimonialBlock } from "@/components/blocks/TestimonialBlock";
import { PricingBlock } from "@/components/blocks/PricingBlock";
import { CtaBandBlock } from "@/components/blocks/CtaBandBlock";
import { FormFieldBlock } from "@/components/blocks/FormFieldBlock";
import { QuizQuestionBlock } from "@/components/blocks/QuizQuestionBlock";
import { ImageBlock } from "@/components/blocks/ImageBlock";

type Block = { id: string; type: string; props: Record<string, unknown> };

// .tsx twin of src/builder/BlockRenderer.jsx (the Hub's builder canvas) —
// same block shape, same visual output, different token names (marketing's
// ivory/ink/green vs the Hub's clay/ink/action). Kept as two ports rather
// than a shared package because the Hub (Vite) and marketing (Next.js)
// build separately and can't cross-import — see
// ~/.claude/plans/tektone-block-builder.md "Rendering pipeline".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, (props: { props: any }) => React.JSX.Element> = {
  hero: HeroBlock,
  richtext: RichtextBlock,
  feature_grid: FeatureGridBlock,
  testimonial: TestimonialBlock,
  pricing: PricingBlock,
  cta_band: CtaBandBlock,
  form_field: FormFieldBlock,
  quiz_question: QuizQuestionBlock,
  image: ImageBlock,
};

export default function BlockRenderer({ blocks }: { blocks: Block[] }) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-8">
      {blocks.map((block) => {
        const Render = REGISTRY[block.type];
        if (!Render) {
          return (
            <div key={block.id} className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              Tipo de bloco desconhecido: {block.type}
            </div>
          );
        }
        return <Render key={block.id} props={block.props || {}} />;
      })}
    </div>
  );
}
