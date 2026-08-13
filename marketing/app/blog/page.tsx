import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BlogGrid from "@/components/BlogGrid";

export const runtime = "edge";

async function getPosts() {
  try {
    const res = await fetch("https://tektone.com.br/hub/api/blog/posts", { next: { revalidate: 300 } });
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
