interface PricingTier {
  name: string;
  price: string;
  features?: string[];
  ctaLabel?: string;
}

interface PricingProps {
  heading?: string;
  tiers?: PricingTier[];
}

export function PricingBlock({ props }: { props: PricingProps }) {
  const tiers = props.tiers?.length ? props.tiers : [];
  return (
    <section>
      {props.heading && (
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-ink">{props.heading}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiers.map((t, i) => (
          <div key={i} className="flex flex-col rounded-xl surface-paper p-5">
            <p className="font-semibold text-ink">{t.name}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{t.price}</p>
            <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink/60">
              {(t.features || []).map((f, j) => (
                <li key={j}>• {f}</li>
              ))}
            </ul>
            {t.ctaLabel && (
              <button className="mt-4 rounded-lg bg-green px-3 py-2 font-semibold text-ivory">
                {t.ctaLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
