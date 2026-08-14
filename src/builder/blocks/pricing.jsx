export const key = "pricing";
export const label = "Tabela de preços";
export const category = "Landing";

export const schema = [
  { key: "heading", label: "Título", type: "text", optional: true },
  {
    key: "tiers",
    label: "Planos",
    type: "array",
    itemLabel: "Plano",
    fields: [
      { key: "name", label: "Nome", type: "text" },
      { key: "price", label: "Preço", type: "text" },
      { key: "features", label: "Itens (um por linha)", type: "list" },
      { key: "ctaLabel", label: "Texto do botão", type: "text", optional: true },
    ],
  },
];

export const defaultProps = {
  heading: "",
  tiers: [{ name: "Plano", price: "R$ 0", features: ["Item 1"], ctaLabel: "Escolher" }],
};

export function Render({ props }) {
  const tiers = props.tiers?.length ? props.tiers : defaultProps.tiers;
  return (
    <section>
      {props.heading && (
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-ink">{props.heading}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiers.map((t, i) => (
          <div key={i} className="flex flex-col rounded-xl surface-2 p-5">
            <p className="font-semibold text-ink">{t.name}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{t.price}</p>
            <ul className="mt-3 flex-1 space-y-1.5 text-sm text-stone-600">
              {(t.features || []).map((f, j) => (
                <li key={j}>• {f}</li>
              ))}
            </ul>
            {t.ctaLabel && (
              <button className="mt-4 rounded-lg bg-action px-3 py-2 font-semibold text-clay">
                {t.ctaLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
