interface CtaBandProps {
  heading?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function CtaBandBlock({ props }: { props: CtaBandProps }) {
  return (
    <section className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-green px-6 py-8 text-center sm:flex-row sm:text-left">
      <h2 className="text-xl font-bold text-ivory">{props.heading || "Pronto para começar?"}</h2>
      {props.ctaLabel && (
        <a
          href={props.ctaHref || "#"}
          className="shrink-0 rounded-lg bg-ivory px-5 py-2.5 font-semibold text-green"
        >
          {props.ctaLabel}
        </a>
      )}
    </section>
  );
}
