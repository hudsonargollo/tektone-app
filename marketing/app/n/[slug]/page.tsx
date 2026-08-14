import { notFound } from "next/navigation";
import { getRequestContext } from "@cloudflare/next-on-pages";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FunnelStep from "@/components/FunnelStep";

export const runtime = "edge";

// Uses the HUB service binding (see wrangler.toml) instead of
// fetch("https://tektone.com.br/hub/...") — a same-zone subrequest from
// this Worker to a different Worker on the same zone gets misrouted back
// into this Worker's own fetch handler rather than reaching tektone-hub.
async function getFunnel(slug: string) {
  const { env } = getRequestContext();
  const res = await env.HUB.fetch(`https://tektone.com.br/hub/api/builder/public/funnel/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { slug } = await params;
  const { step } = await searchParams;
  const data = await getFunnel(slug);
  if (!data) notFound();

  const { funnel, steps } = data;
  const currentIndex = step === "done" ? -1 : Number(step) || 0;

  return (
    <>
      <Navbar theme="light" />
      <main className="relative min-h-screen bg-ivory pt-32 pb-24">
        <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
        <div className="relative mx-auto max-w-xl px-6">
          <h1 className="mb-8 text-3xl font-bold tracking-tight text-ink">{funnel.title}</h1>
          <FunnelStep funnelSlug={slug} steps={steps} currentIndex={currentIndex} />
        </div>
      </main>
      <Footer />
    </>
  );
}
