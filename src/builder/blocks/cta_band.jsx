export const key = "cta_band";
export const label = "Faixa de CTA";
export const category = "Landing";

export const schema = [
  { key: "heading", label: "Título", type: "text" },
  { key: "ctaLabel", label: "Texto do botão", type: "text" },
  { key: "ctaHref", label: "Link do botão", type: "url" },
];

export const defaultProps = {
  heading: "Pronto para começar?",
  ctaLabel: "Falar com a gente",
  ctaHref: "",
};

export function Render({ props }) {
  return (
    <section className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-action px-6 py-8 text-center sm:flex-row sm:text-left">
      <h2 className="text-xl font-bold text-clay">{props.heading || defaultProps.heading}</h2>
      {props.ctaLabel && (
        <a
          href={props.ctaHref || "#"}
          className="shrink-0 rounded-lg bg-clay px-5 py-2.5 font-semibold text-action"
        >
          {props.ctaLabel}
        </a>
      )}
    </section>
  );
}
