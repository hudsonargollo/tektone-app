import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app now lives inside the tektone-app monorepo (marketing/), which
  // has its own package-lock.json alongside the parent repo's — without
  // this, Next.js's workspace-root inference gets confused between the two
  // and warns on every build.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};

if (process.env.NODE_ENV === "development") {
  await setupDevPlatform();
}

export default nextConfig;
