interface QuizOption {
  label: string;
  value: string;
  scoreWeight?: number;
}

interface QuizQuestionProps {
  label?: string;
  type?: "single" | "multi" | "text";
  options?: QuizOption[];
}

export function QuizQuestionBlock({ props }: { props: QuizQuestionProps }) {
  const { label, type, options } = props;
  return (
    <div>
      <p className="mb-3 font-semibold text-ink">{label || "Pergunta"}</p>
      {type === "text" ? (
        <input type="text" className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 text-ink" />
      ) : (
        <div className="space-y-2">
          {(options || []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 rounded-lg surface-paper px-3 py-2 text-sm text-ink">
              <input type={type === "multi" ? "checkbox" : "radio"} readOnly disabled />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
