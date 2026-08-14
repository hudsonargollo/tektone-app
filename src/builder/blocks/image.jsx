export const key = "image";
export const label = "Imagem";
export const category = "Conteúdo";

export const schema = [
  { key: "src", label: "Imagem", type: "image" },
  { key: "alt", label: "Texto alternativo", type: "text" },
  { key: "caption", label: "Legenda", type: "text", optional: true },
];

export const defaultProps = { src: "", alt: "", caption: "" };

export function Render({ props }) {
  if (!props.src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl surface-2 text-sm text-stone-400">
        Sem imagem
      </div>
    );
  }
  return (
    <figure>
      <img src={props.src} alt={props.alt || ""} className="w-full rounded-xl object-cover" />
      {props.caption && (
        <figcaption className="mt-2 text-center text-sm text-stone-500">{props.caption}</figcaption>
      )}
    </figure>
  );
}
