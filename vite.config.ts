import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Milestone 3 (ROADMAP.md): PWA-ify.
//
// ARCHITECTURE.md's diagram calls for "network-first / stale-while-revalidate" price data
// and a genuinely offline-first app shell. In this app price data isn't a separately-fetched
// resource — it's baked into the JS bundle at build time (ARCHITECTURE.md §1, "build-time
// fetch"), so there's no separate JSON endpoint to apply a runtimeCaching rule to. The
// equivalent behavior for a bundled-data SPA is `registerType: "autoUpdate"`: the service
// worker checks for a new build on every load and activates it immediately when online
// (network-first freshness for the whole versioned bundle, data included), while falling
// back to the precached bundle when offline (the genuinely-offline-first app shell).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Tipid Hacks — Fast Food Budget Optimizer",
        short_name: "Tipid Hacks",
        description: "Find the cheapest fast-food order that feeds your group in the Philippines.",
        theme_color: "#1f7a5c",
        background_color: "#f1ece0",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the app shell (JS/CSS/HTML/icons) — offline-first by design.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
