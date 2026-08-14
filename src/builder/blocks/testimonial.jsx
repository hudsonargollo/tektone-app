export const key = "testimonial";
export const label = "Depoimentos";
export const category = "Prova social";

export const schema = [
  {
    key: "items",
    label: "Depoimentos",
    type: "array",
    itemLabel: "Depoimento",
    fields: [
      { key: "quote", label: "Depoimento", type: "textarea" },
      { key: "name", label: "Nome", type: "text" },
      { key: "role", label: "Cargo/empresa", type: "text", optional: true },
      { key: "avatar", label: "Foto", type: "image", optional: true },
    ],
  },
];

export const defaultProps = {
  items: [{ quote: "Depoimento do cliente.", name: "Nome", role: "", avatar: "" }],
};

export function Render({ props }) {
  const items = props.items?.length ? props.items : defaultProps.items;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((it, i) => (
        <figure key={i} className="rounded-xl surface-2 p-5">
          <blockquote className="text-pretty leading-relaxed text-stone-600">
            &ldquo;{it.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-3 flex items-center gap-2">
            {it.avatar && (
              <img src={it.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            )}
            <div>
              <p className="text-sm font-semibold text-ink">{it.name}</p>
              {it.role && <p className="text-xs text-stone-500">{it.role}</p>}
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
