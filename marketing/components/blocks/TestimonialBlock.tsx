interface TestimonialItem {
  quote: string;
  name: string;
  role?: string;
  avatar?: string;
}

interface TestimonialProps {
  items?: TestimonialItem[];
}

export function TestimonialBlock({ props }: { props: TestimonialProps }) {
  const items = props.items?.length ? props.items : [];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((it, i) => (
        <figure key={i} className="rounded-xl surface-paper p-5">
          <blockquote className="text-pretty leading-relaxed text-ink/60">&ldquo;{it.quote}&rdquo;</blockquote>
          <figcaption className="mt-3 flex items-center gap-2">
            {it.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            )}
            <div>
              <p className="text-sm font-semibold text-ink">{it.name}</p>
              {it.role && <p className="text-xs text-ink/50">{it.role}</p>}
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
