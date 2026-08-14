interface HeroProps {
  heading?: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  image?: string;
}

export function HeroBlock({ props }: { props: HeroProps }) {
  return (
    <section className="rounded-2xl surface-paper px-6 py-12 text-center sm:px-12 sm:py-16">
      {props.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.image} alt="" className="mx-auto mb-6 max-h-40 rounded-xl object-cover" />
      )}
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {props.heading || "Título da página"}
      </h1>
      {props.subheading && (
        <p className="mx-auto mt-3 max-w-xl text-pretty text-ink/60">{props.subheading}</p>
      )}
      {props.ctaLabel && (
        <a
          href={props.ctaHref || "#"}
          className="mt-6 inline-block rounded-lg bg-green px-5 py-2.5 font-semibold text-ivory"
        >
          {props.ctaLabel}
        </a>
      )}
    </section>
  );
}
