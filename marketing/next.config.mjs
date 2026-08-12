import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
import { withNextVideo } from "next-video/process";
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

// next-video: stores/optimizes video source files off-repo. Cloudflare R2
// (not Mux, the library's default) since this project already lives on
// Cloudflare — dedicated bucket `tektone-founder-video`, public access
// enabled, credentials via R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY env vars.
export default withNextVideo(nextConfig, {
  provider: "cloudflare-r2",
  providerConfig: {
    "cloudflare-r2": {
      // R2's S3-compatible API endpoint, scoped to the TEKTONE Cloudflare
      // account (193882a3226d5fb9c3611ea50c95992e) — required by the S3
      // client next-video uses under the hood; without it, uploads fail.
      endpoint: "https://193882a3226d5fb9c3611ea50c95992e.r2.cloudflarestorage.com",
      bucket: "tektone-founder-video",
      bucketUrlPublic: process.env.R2_BUCKET_URL_PUBLIC,
    },
  },
});
