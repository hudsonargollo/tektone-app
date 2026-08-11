import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Separate build target for the CRM (tektone.com.br/crm) — see
// wrangler.crm.toml and worker/crm-entry.js. Same shape as
// vite.portal.config.js: distinct base path, entry HTML, output dir.
export default defineConfig({
  base: "/crm/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist-crm",
    rollupOptions: {
      input: fileURLToPath(new URL("./crm.html", import.meta.url)),
    },
  },
});
