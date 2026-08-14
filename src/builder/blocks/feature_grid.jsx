export const key = "feature_grid";
export const label = "Grade de features";
export const category = "Landing";

export const schema = [
  { key: "heading", label: "Título", type: "text", optional: true },
  {
    key: "items",
    label: "Features",
    type: "array",
    itemLabel: "Feature",
    fields: [
      { key: "icon", label: "Ícone (emoji)", type: "text", optional: true },
      { key: "title", label: "Título", type: "text" },
      { key: "description", label: "Descrição", type: "textarea" },
    ],
  },
];

export const defaultProps = {
  heading: "",
  items: [{ icon: "✦", title: "Feature", description: "Descrição curta da feature." }],
};

export function Render({ props }) {
  const items = props.items?.length ? props.items : defaultProps.items;
  return (
    <section>
      {props.heading && (
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-ink">{props.heading}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl surface-2 p-5">
            {it.icon && <div className="mb-2 text-2xl">{it.icon}</div>}
            <p className="font-semibold text-ink">{it.title}</p>
            {it.description && <p className="mt-1 text-sm text-stone-600">{it.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
