export const key = "quiz_question";
export const label = "Pergunta de quiz";
export const category = "Quiz";

export const schema = [
  { key: "label", label: "Pergunta", type: "text" },
  {
    key: "type",
    label: "Tipo",
    type: "select",
    options: [
      { label: "Escolha única", value: "single" },
      { label: "Múltipla escolha", value: "multi" },
      { label: "Texto livre", value: "text" },
    ],
  },
  {
    key: "options",
    label: "Opções",
    type: "array",
    itemLabel: "Opção",
    optional: true,
    fields: [
      { key: "label", label: "Texto", type: "text" },
      { key: "value", label: "Valor", type: "text" },
      { key: "scoreWeight", label: "Peso na pontuação", type: "number", optional: true },
    ],
  },
];

export const defaultProps = {
  label: "Pergunta",
  type: "single",
  options: [{ label: "Opção A", value: "a", scoreWeight: 0 }],
};

export function Render({ props }) {
  const { label: questionLabel, type, options } = { ...defaultProps, ...props };
  return (
    <div>
      <p className="mb-3 font-semibold text-ink">{questionLabel || "Pergunta"}</p>
      {type === "text" ? (
        <input
          type="text"
          readOnly
          className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 text-ink"
        />
      ) : (
        <div className="space-y-2">
          {(options?.length ? options : defaultProps.options).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 rounded-lg surface-2 px-3 py-2 text-sm text-ink">
              <input type={type === "multi" ? "checkbox" : "radio"} readOnly disabled />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
