import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRequestContext } from "@cloudflare/next-on-pages";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MarkdownBody from "@/components/MarkdownBody";

export const runtime = "edge";

// Uses the HUB service binding (see wrangler.toml) instead of
// fetch("https://tektone.com.br/hub/...") — a same-zone subrequest from
// this Worker to a different Worker on the same zone gets misrouted back
// into this Worker's own fetch handler rather than reaching tektone-hub.
async function getPost(slug: string) {
  try {
    const { env } = getRequestContext();
    const res = await env.HUB.fetch(`https://tektone.com.br/hub/api/blog/posts/${slug}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.post || null;
  } catch {
    return null;
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <>
      <Navbar theme="light" />
      <main className="relative min-h-screen bg-ivory pt-32 pb-24">
        <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
        <article className="relative mx-auto max-w-2xl px-6">
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-ink/50 transition-colors hover:text-green"
          >
            <ArrowLeft size={12} /> arquivo
          </Link>

          <p className="label-tech mb-3">{post.pillar_name}</p>
          <h1 className="text-balance text-3xl sm:text-4xl font-bold leading-tight tracking-display text-ink">
            {post.title}
          </h1>

          {post.cover_illustration && (
            <div className="relative mt-8 aspect-[4/3] w-full overflow-hidden rounded-2xl">
              <Image
                src={`https://tektone.com.br/hub/api/blog/media/${post.cover_illustration}`}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className="mt-10">
            <MarkdownBody content={post.content} />
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
