<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { refresh, REFRESH_OPTIONS } from "$lib/refresh.svelte";

  const isActive = (path: string): boolean =>
    path === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(path);
</script>

<header>
  <a class="brand" href={resolve("/")}>
    <h1>vps-cron</h1>
  </a>

  <nav>
    <a href={resolve("/")} aria-current={isActive("/") ? "page" : undefined}>jobs</a>
    <span class="sep">/</span>
    <a href={resolve("/history")} aria-current={isActive("/history") ? "page" : undefined}>
      history
    </a>
  </nav>

  <label class="rate">
    <span>refresh</span>
    <select bind:value={refresh.ms}>
      {#each REFRESH_OPTIONS as option (option.ms)}
        <option value={option.ms}>{option.label}</option>
      {/each}
    </select>
  </label>
</header>

<style lang="scss">
  header {
    position: sticky;
    top: 0;
    z-index: 10;

    display: flex;
    align-items: baseline;
    gap: 1.5rem;
    flex-wrap: wrap;

    padding: 1.25rem var(--gutter);
    border-bottom: 1px dotted var(--line);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(6px);
  }

  h1 {
    font-size: 1.35rem;
    font-weight: 500;
    letter-spacing: 0.06em;
  }

  nav {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    letter-spacing: 0.08em;

    a {
      opacity: 0.6;
      transition: opacity 0.15s ease;

      &:hover {
        opacity: 1;
      }

      &[aria-current="page"] {
        opacity: 1;
        border-bottom: 1px dotted currentcolor;
      }
    }

    .sep {
      opacity: 0.35;
    }
  }

  header:has(nav a:hover) nav a:not(:hover) {
    opacity: 0.4;
  }

  .rate {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-left: auto;
    font-size: 0.8rem;
    letter-spacing: 0.08em;

    span {
      opacity: 0.5;
    }

    select {
      padding: 0.15rem 0.3rem;
      border: 1px dotted var(--line);
      font-size: 0.8rem;

      option {
        background: var(--bg-raised);
      }
    }
  }
</style>
