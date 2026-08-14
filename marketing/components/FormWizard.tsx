"use client";

import { useState } from "react";
import { RichtextBlock } from "@/components/blocks/RichtextBlock";
import { ImageBlock } from "@/components/blocks/ImageBlock";

interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

interface Props {
  slug: string;
  blocks: Block[];
}

const INPUT_CLASS =
  "w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 text-ink placeholder:text-ink/40";

function InteractiveFormField({
  block,
  value,
  onChange,
}: {
  block: Block;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { label, fieldType, required, options } = block.props as {
    label?: string;
    fieldType?: string;
    required?: boolean;
    options?: string[];
  };
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">
        {label || "Pergunta"}
        {required && <span className="text-danger"> *</span>}
      </label>
      {fieldType === "textarea" ? (
        <textarea
          rows={4}
          className={INPUT_CLASS}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : fieldType === "select" ? (
        <select className={INPUT_CLASS} value={(value as string) || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Selecione…
          </option>
          {(options || []).map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={fieldType === "email" ? "email" : fieldType === "phone" ? "tel" : "text"}
          className={INPUT_CLASS}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function InteractiveQuizQuestion({
  block,
  value,
  onChange,
}: {
  block: Block;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { label, type, options } = block.props as {
    label?: string;
    type?: "single" | "multi" | "text";
    options?: { label: string; value: string }[];
  };

  function toggleMulti(val: string) {
    const current = Array.isArray(value) ? (value as string[]) : [];
    onChange(current.includes(val) ? current.filter((v) => v !== val) : [...current, val]);
  }

  return (
    <div>
      <p className="mb-3 font-semibold text-ink">{label || "Pergunta"}</p>
      {type === "text" ? (
        <input
          type="text"
          className={INPUT_CLASS}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="space-y-2">
          {(options || []).map((opt, i) => {
            const checked = type === "multi" ? Array.isArray(value) && (value as string[]).includes(opt.value) : value === opt.value;
            return (
              <label
                key={i}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm text-ink transition-colors ${
                  checked ? "border-green bg-green/10" : "border-ink/10 surface-paper"
                }`}
              >
                <input
                  type={type === "multi" ? "checkbox" : "radio"}
                  checked={checked}
                  onChange={() => (type === "multi" ? toggleMulti(opt.value) : onChange(opt.value))}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One question per step, matching kind === 'form' | 'quiz' documents —
// richtext/image blocks are intro copy, rendered statically between steps
// via the same static block components used elsewhere. Client component
// because it holds wizard state and posts the answers on submit (a real
// browser fetch, not a server-side same-zone subrequest, so no HUB
// service-binding issue here — see /p/[slug] and /blog/[slug] for that).
export default function FormWizard({ slug, blocks }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ score?: number; tier?: string | null } | null>(null);

  const interactive = blocks.filter((b) => b.type === "form_field" || b.type === "quiz_question");
  const intro = blocks.filter((b) => b.type === "richtext" || b.type === "image");
  const current = interactive[step];
  const isLast = step === interactive.length - 1;

  function setAnswer(blockId: string, value: unknown) {
    setAnswers((a) => ({ ...a, [blockId]: value }));
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/hub/api/builder/public/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao enviar.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl surface-paper p-8 text-center">
        <p className="text-lg font-semibold text-ink">Obrigado!</p>
        <p className="mt-2 text-ink/60">Sua resposta foi enviada.</p>
        {typeof result.score === "number" && (
          <p className="mt-4 font-mono text-sm text-ink/50">
            pontuação: {result.score}
            {result.tier ? ` · ${result.tier}` : ""}
          </p>
        )}
      </div>
    );
  }

  if (!current) {
    return <p className="text-ink/60">Nenhuma pergunta configurada ainda.</p>;
  }

  return (
    <div className="space-y-8">
      {intro.map((block) =>
        block.type === "richtext" ? (
          <RichtextBlock key={block.id} props={block.props} />
        ) : (
          <ImageBlock key={block.id} props={block.props} />
        )
      )}

      <div className="rounded-2xl surface-paper p-6">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-wider text-ink/40">
          {step + 1} / {interactive.length}
        </p>

        {current.type === "form_field" ? (
          <InteractiveFormField block={current} value={answers[current.id]} onChange={(v) => setAnswer(current.id, v)} />
        ) : (
          <InteractiveQuizQuestion block={current} value={answers[current.id]} onChange={(v) => setAnswer(current.id, v)} />
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg px-4 py-2 text-sm text-ink/50 disabled:opacity-30"
          >
            voltar
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-lg bg-green px-5 py-2.5 font-semibold text-ivory disabled:opacity-50"
            >
              {submitting ? "enviando…" : "enviar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(interactive.length - 1, s + 1))}
              className="rounded-lg bg-green px-5 py-2.5 font-semibold text-ivory"
            >
              próxima
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
