interface FormFieldProps {
  label?: string;
  fieldType?: "text" | "email" | "phone" | "textarea" | "select";
  required?: boolean;
  options?: string[];
}

const INPUT_CLASS =
  "w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 text-ink placeholder:text-ink/40";

export function FormFieldBlock({ props }: { props: FormFieldProps }) {
  const { label, fieldType, required, options } = props;
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">
        {label || "Pergunta"}
        {required && <span className="text-danger"> *</span>}
      </label>
      {fieldType === "textarea" ? (
        <textarea rows={3} className={INPUT_CLASS} />
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
        />
      )}
    </div>
  );
}
