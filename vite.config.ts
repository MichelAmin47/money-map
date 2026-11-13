import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// GitHub Pages serveert de app onder /<repo-naam>/. Pas dit aan als de repo
// een andere naam krijgt (of zet VITE_BASE bij een eigen domein op "/").
const base = process.env.VITE_BASE ?? "/money-map/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Huishoudboek",
        short_name: "Huishoudboek",
        description: "Persoonlijk huishoudboek: potten, weken en vaste lasten.",
        lang: "nl",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#E9EDE4",
        theme_color: "#E9EDE4",
        icons: [
          { src: "icoon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icoon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icoon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
