// GitHub Pages build config — static export variant of vite.config.ts.
// The default config targets the Vercel preset (server functions); Pages
// serves static files only, so this clones the plugin set with:
//   - nitro preset "static" (prerenders "/" to plain files)
//   - base path for project-site URLs (https://<user>.github.io/<repo>/)
// Usage: node scripts/with-app-env.mjs vite build --config vite.config.pages.ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";

const base = process.env.PAGES_BASE || "/stillwood/";

export default defineConfig(() => ({
  base,
  resolve: { tsconfigPaths: true },
  plugins: [
    appEnvPlugin(),
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "static" }),
    viteReact(),
  ],
}));
