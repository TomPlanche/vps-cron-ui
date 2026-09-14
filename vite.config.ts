import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

/**
 * Where the status server lives during `vite dev` and `vite preview`.
 *
 * The deployed site talks to it on its own origin, so dev has to look the
 * same: the API sends no CORS headers, and a cross-origin fetch from the page
 * would be refused. A proxy is server-side, so it is not subject to that, and
 * pointing it at the live domain means `pnpm dev` needs no tunnel. Set
 * `VPS_CRON_ORIGIN=http://127.0.0.1:8787` to work against a tunnelled or local
 * scheduler instead.
 */
const API = process.env.VPS_CRON_ORIGIN ?? "https://cron.tomplanche.com";

/** The three paths the status server owns. The app's own pages avoid them. */
const proxy = Object.fromEntries(
  ["/health", "/jobs", "/runs"].map((path) => [path, { target: API, changeOrigin: true }])
);

export default defineConfig({
  plugins: [sveltekit()],
  server: { proxy },
  preview: { proxy }
});
