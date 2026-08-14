import { getRequestContext } from "@cloudflare/next-on-pages";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BlogGrid from "@/components/BlogGrid";

export const runtime = "edge";

// Uses the HUB service binding (see wrangler.toml) instead of
// fetch("https://tektone.com.br/hub/...") — a same-zone subrequest from
// this Worker to a different Worker on the same zone gets misrouted back
// into this Worker's own fetch handler rather than reaching tektone-hub.
async function getPosts() {
  try {
    const { env } = getRequestContext();
    const res = await env.HUB.fetch("https://tektone.com.br/hub/api/blog/posts");
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts || [];
  } catch {
    return [];
  }
}

export default async function BlogIndexPage() {
  const posts = await getPosts();

  return (
    <>
      <Navbar theme="light" />
      <main className="relative min-h-screen bg-ivory pt-32 pb-24">
        <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="mb-14">
            <p className="label-tech mb-4">Tektone · Arquivo</p>
            <h1 className="text-balance text-4xl sm:text-5xl font-bold leading-tight tracking-display text-ink">
              Notas de um construtor.
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-ink/60">
              Sistemas, produtos e as decisões por trás de como a Tektone constrói.
            </p>
          </div>

          <BlogGrid posts={posts} />
        </div>
      </main>
      <Footer />
    </>
  );
}
