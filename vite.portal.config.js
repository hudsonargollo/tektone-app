import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Separate build target for the customer-only portal (tektone.com.br/portal)
// — see wrangler.portal.toml and worker/portal-entry.js. Same plugins/alias
// as vite.config.js, but a distinct base path, entry HTML, and output dir
// since Vite's `base` is one value per build; the hub and portal frontends
// can't share a single build with two different path prefixes baked in.
export default defineConfig({
  base: "/portal/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist-portal",
    rollupOptions: {
      input: fileURLToPath(new URL("./portal.html", import.meta.url)),
    },
  },
});
