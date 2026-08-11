import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app now lives inside the tektone-app monorepo (marketing/), which
  // has its own package-lock.json alongside the parent repo's — without
  // this, Next.js's workspace-root inference gets confused between the two
  // and warns on every build.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  images: {
    // Blog cover illustrations are served from /hub's API (see
    // functions/api/blog/[[path]].js's /media route, backed by R2) — same
    // zone, different Worker, so next/image still treats it as "remote".
    remotePatterns: [{ protocol: "https", hostname: "tektone.com.br", pathname: "/hub/api/blog/media/**" }],
  },
};

if (process.env.NODE_ENV === "development") {
  await setupDevPlatform();
}

export default nextConfig;
