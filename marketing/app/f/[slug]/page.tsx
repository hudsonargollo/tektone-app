import { notFound } from "next/navigation";
import { getRequestContext } from "@cloudflare/next-on-pages";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FormWizard from "@/components/FormWizard";

export const runtime = "edge";

// Uses the HUB service binding (see wrangler.toml) instead of
// fetch("https://tektone.com.br/hub/...") — a same-zone subrequest from
// this Worker to a different Worker on the same zone gets misrouted back
// into this Worker's own fetch handler rather than reaching tektone-hub.
async function getDoc(slug: string) {
  const { env } = getRequestContext();
  const res = await env.HUB.fetch(`https://tektone.com.br/hub/api/builder/public/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.document || null;
}

export default async function FormOrQuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();

  return (
    <>
      <Navbar theme="light" />
      <main className="relative min-h-screen bg-ivory pt-32 pb-24">
        <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
        <div className="relative mx-auto max-w-xl px-6">
          <h1 className="mb-8 text-3xl font-bold tracking-tight text-ink">{doc.title}</h1>
          <FormWizard slug={slug} blocks={doc.blocks} />
        </div>
      </main>
      <Footer />
    </>
  );
}
