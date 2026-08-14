export const key = "hero";
export const label = "Hero";
export const category = "Landing";

export const schema = [
  { key: "heading", label: "Título", type: "text" },
  { key: "subheading", label: "Subtítulo", type: "textarea" },
  { key: "ctaLabel", label: "Texto do botão", type: "text" },
  { key: "ctaHref", label: "Link do botão", type: "url" },
  { key: "image", label: "Imagem", type: "image", optional: true },
];

export const defaultProps = {
  heading: "Título da página",
  subheading: "Subtítulo explicando a proposta.",
  ctaLabel: "Falar com a gente",
  ctaHref: "",
  image: "",
};

export function Render({ props }) {
  return (
    <section className="rounded-2xl surface-2 px-6 py-12 text-center sm:px-12 sm:py-16">
      {props.image && (
        <img src={props.image} alt="" className="mx-auto mb-6 max-h-40 rounded-xl object-cover" />
      )}
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {props.heading || "Título da página"}
      </h1>
      {props.subheading && (
        <p className="mx-auto mt-3 max-w-xl text-pretty text-stone-600">{props.subheading}</p>
      )}
      {props.ctaLabel && (
        <a
          href={props.ctaHref || "#"}
          className="mt-6 inline-block rounded-lg bg-action px-5 py-2.5 font-semibold text-clay"
        >
          {props.ctaLabel}
        </a>
      )}
    </section>
  );
}
