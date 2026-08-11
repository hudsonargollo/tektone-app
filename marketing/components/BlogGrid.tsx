import Link from "next/link";
import Image from "next/image";

type Post = {
  slug: string;
  title: string;
  excerpt?: string;
  cover_illustration?: string | null;
  pillar_name: string;
  pillar_slug: string;
  published_at: string;
};

export default function BlogGrid({ posts }: { posts: Post[] }) {
  if (!posts.length) {
    return (
      <p className="rounded-2xl surface-paper p-8 text-center text-sm text-ink/50">
        Nenhum artigo publicado ainda — volte em breve.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="group flex flex-col overflow-hidden rounded-2xl surface-paper-raised transition-transform duration-300 hover:-translate-y-1"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-sand/20">
            {post.cover_illustration ? (
              <Image
                src={`https://tektone.com.br/hub/api/blog/media/${post.cover_illustration}`}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sand/30 to-green/10">
                <span className="label-tech">Tektone</span>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-5">
            <p className="label-tech mb-2">{post.pillar_name}</p>
            <h2 className="text-balance text-lg font-bold leading-snug tracking-tightish text-ink">{post.title}</h2>
            {post.excerpt && (
              <p className="mt-2 line-clamp-2 text-pretty text-sm leading-relaxed text-ink/60">{post.excerpt}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
