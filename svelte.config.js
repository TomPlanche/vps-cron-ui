import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    // A single-page app: every route is client-rendered and the whole site is
    // a handful of static files, so any web server (or `python -m http.server`
    // through an SSH tunnel) can serve it.
    adapter: adapter({ fallback: "index.html", precompress: true }),
    prerender: { entries: [] }
  }
};

export default config;
