interface FeatureItem {
  icon?: string;
  title: string;
  description?: string;
}

interface FeatureGridProps {
  heading?: string;
  items?: FeatureItem[];
}

export function FeatureGridBlock({ props }: { props: FeatureGridProps }) {
  const items = props.items?.length ? props.items : [];
  return (
    <section>
      {props.heading && (
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-ink">{props.heading}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl surface-paper p-5">
            {it.icon && <div className="mb-2 text-2xl">{it.icon}</div>}
            <p className="font-semibold text-ink">{it.title}</p>
            {it.description && <p className="mt-1 text-sm text-ink/60">{it.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
