export const key = "form_field";
export const label = "Campo de formulário";
export const category = "Formulário";

export const schema = [
  { key: "label", label: "Pergunta/Rótulo", type: "text" },
  {
    key: "fieldType",
    label: "Tipo",
    type: "select",
    options: [
      { label: "Texto curto", value: "text" },
      { label: "E-mail", value: "email" },
      { label: "Telefone", value: "phone" },
      { label: "Texto longo", value: "textarea" },
      { label: "Seleção", value: "select" },
    ],
  },
  { key: "required", label: "Obrigatório", type: "boolean" },
  {
    key: "options",
    label: "Opções (para seleção)",
    type: "list",
    optional: true,
  },
];

export const defaultProps = {
  label: "Pergunta",
  fieldType: "text",
  required: false,
  options: [],
};

const INPUT_CLASS =
  "w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 text-ink placeholder:text-stone-400";

export function Render({ props }) {
  const { label: fieldLabel, fieldType, required, options } = { ...defaultProps, ...props };
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">
        {fieldLabel || "Pergunta"}
        {required && <span className="text-danger"> *</span>}
      </label>
      {fieldType === "textarea" ? (
        <textarea rows={3} className={INPUT_CLASS} readOnly />
      ) : fieldType === "select" ? (
        <select className={INPUT_CLASS} defaultValue="">
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
          readOnly
        />
      )}
    </div>
  );
}
