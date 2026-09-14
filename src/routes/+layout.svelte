<script lang="ts">
  import "$lib/styles/main.scss";

  import { page } from "$app/state";
  import { API_BASE } from "$lib/api";
  import Header from "$lib/components/Header.svelte";

  let { children } = $props();

  /** An empty base means this site's own origin, which is worth spelling out. */
  const source = $derived(API_BASE === "" ? page.url.origin : API_BASE);
</script>

<svelte:head>
  <title>vps-cron</title>
  <meta name="description" content="Status of the vps-cron scheduler." />
</svelte:head>

<Header />

<main>
  {@render children()}
</main>

<footer>
  <span>read-only status server at <code>{source}</code></span>
</footer>

<style lang="scss">
  main {
    flex: 1;
    width: 100%;
    max-width: 80rem;
    margin: 0 auto;
    padding: 1.5rem var(--gutter) 3rem;
  }

  footer {
    padding: 1rem var(--gutter) 1.5rem;
    border-top: 1px dotted var(--line);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    opacity: 0.4;

    code {
      font: inherit;
    }
  }
</style>
