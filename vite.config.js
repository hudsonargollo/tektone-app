import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Deployed at tektone.com.br/hub (path-mounted, no subdomain — see plan at
  // ~/.claude/plans/wise-riding-wirth.md) instead of its own domain root, so
  // every asset/API reference the app makes must be relative to this prefix.
  base: "/hub/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
