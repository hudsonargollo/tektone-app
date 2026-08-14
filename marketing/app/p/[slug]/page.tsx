import { notFound } from "next/navigation";
import { getRequestContext } from "@cloudflare/next-on-pages";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BlockRenderer from "@/components/BlockRenderer";

export const runtime = "edge";

// Uses the HUB service binding (see wrangler.toml) instead of
// fetch("https://tektone.com.br/hub/...") — a same-zone subrequest from
// this Worker to a different Worker on the same zone gets misrouted back
// into this Worker's own fetch handler rather than reaching tektone-hub.
async function getPage(slug: string) {
  const { env } = getRequestContext();
  const res = await env.HUB.fetch(`https://tektone.com.br/hub/api/builder/documents/page/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.document || null;
}

export default async function BuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <>
      <Navbar theme="light" />
      <main className="relative min-h-screen bg-ivory pt-32 pb-24">
        <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6">
          <BlockRenderer blocks={page.blocks} />
        </div>
      </main>
      <Footer />
    </>
  );
}
