// GitHub Pages SPA build: the game itself is fully client-side, so this
// bypasses the TanStack Start/Nitro server layer entirely and mounts the game
// component directly. Usage: npm run build:pages (output in pages-dist/).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const base = process.env.PAGES_BASE || "/stillwood/";

export default defineConfig({
  base,
  root: "pages",
  publicDir: "../public",
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "../pages-dist",
    emptyOutDir: true,
  },
});
