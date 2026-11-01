import { defineConfig } from "vite";
import { resolve } from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  // multi-page: unknown URLs get 404.html in dev/preview, matching the CloudFront setup
  appType: "mpa",
  // lets a temporary Cloudflare tunnel reach `npm run preview` when sharing a link
  preview: { allowedHosts: [".trycloudflare.com"] },
  build: {
    target: "es2020",
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        notfound: resolve(root, "404.html"),
      },
    },
  },
});
