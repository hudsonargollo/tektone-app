interface ImageProps {
  src?: string;
  alt?: string;
  caption?: string;
}

export function ImageBlock({ props }: { props: ImageProps }) {
  if (!props.src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl surface-paper text-sm text-ink/40">
        Sem imagem
      </div>
    );
  }
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={props.src} alt={props.alt || ""} className="w-full rounded-xl object-cover" />
      {props.caption && <figcaption className="mt-2 text-center text-sm text-ink/50">{props.caption}</figcaption>}
    </figure>
  );
}
