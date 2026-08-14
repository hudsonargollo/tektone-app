"use client";

import { useRouter } from "next/navigation";
import BlockRenderer from "@/components/BlockRenderer";
import FormWizard from "@/components/FormWizard";

interface Step {
  stepIndex: number;
  documentId: string;
  kind: string;
  slug: string;
  title: string;
  blocks: { id: string; type: string; props: Record<string, unknown> }[];
  nextRule: { default: number | null; branches?: { tier: string; goto: number }[] } | null;
}

interface Props {
  funnelSlug: string;
  steps: Step[];
  currentIndex: number;
}

// Every step falls through to nextRule.default; only a quiz step's tier can
// fork it — see FunnelBuilder.jsx's BranchEditor, the admin-side twin of
// this resolver. A missing/absent rule (last step) ends the funnel.
function resolveNext(nextRule: Step["nextRule"], result?: { tier?: string | null }) {
  if (!nextRule) return null;
  if (result?.tier && nextRule.branches) {
    const match = nextRule.branches.find((b) => b.tier === result.tier);
    if (match) return match.goto;
  }
  return nextRule.default ?? null;
}

export default function FunnelStep({ funnelSlug, steps, currentIndex }: Props) {
  const router = useRouter();
  const step = steps[currentIndex];

  function goTo(index: number | null) {
    router.push(`/n/${funnelSlug}?step=${index == null ? "done" : index}`);
  }

  if (!step) {
    return (
      <div className="rounded-2xl surface-paper p-8 text-center">
        <p className="text-lg font-semibold text-ink">Obrigado!</p>
        <p className="mt-2 text-ink/60">Você concluiu esta jornada.</p>
      </div>
    );
  }

  if (step.kind === "page") {
    return (
      <div>
        <BlockRenderer blocks={step.blocks} />
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => goTo(resolveNext(step.nextRule))}
            className="rounded-lg bg-green px-5 py-2.5 font-semibold text-ivory"
          >
            continuar
          </button>
        </div>
      </div>
    );
  }

  return <FormWizard slug={step.slug} blocks={step.blocks} onSubmitted={(result) => goTo(resolveNext(step.nextRule, result))} />;
}
