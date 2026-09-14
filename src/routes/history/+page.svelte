<script lang="ts">
  import type { Outcome } from "$lib/api";
  import { fetchRuns } from "$lib/api";
  import { formatRelative } from "$lib/format";
  import { createPoll, createTicker } from "$lib/poll.svelte";
  import { refresh } from "$lib/refresh.svelte";
  import { TextMorph } from "torph/svelte";

  import RunList from "$lib/components/RunList.svelte";

  /** How many history rows to ask for. The server clamps anything above 500. */
  const LIMITS = [50, 100, 200, 500] as const;

  const OUTCOMES: readonly Outcome[] = ["success", "failure", "timeout", "skipped"];

  const runs = createPoll((signal) => fetchRuns(undefined, limit, signal));
  const ticker = createTicker();

  let limit = $state(100);
  let outcome = $state<Outcome | "all">("all");

  const all = $derived(runs.data ?? []);
  const shown = $derived(outcome === "all" ? all : all.filter((run) => run.outcome === outcome));

  $effect(() => ticker.start());

  $effect(() => {
    void limit;
    return runs.start(refresh.ms);
  });
</script>

<svelte:head>
  <title>history - vps-cron</title>
</svelte:head>

<header class="toolbar">
  <div class="filters">
    <button type="button" class:active={outcome === "all"} onclick={() => (outcome = "all")}>
      all
    </button>
    {#each OUTCOMES as option (option)}
      <button
        type="button"
        class:active={outcome === option}
        disabled={all.every((run) => run.outcome !== option)}
        onclick={() => (outcome = option)}
      >
        {option}
      </button>
    {/each}
  </div>

  <label>
    <span>last</span>
    <select bind:value={limit}>
      {#each LIMITS as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </label>

  <p class="updated">
    {#if runs.error}
      <span class="stale">stale: {runs.error}</span>
    {:else if runs.updatedAt}
      updated <TextMorph
        text={formatRelative(new Date(runs.updatedAt).toISOString(), ticker.now)}
      />
    {/if}
  </p>
</header>

{#if runs.loading && runs.data === undefined}
  <p class="note">Loading...</p>
{:else if runs.error && runs.data === undefined}
  <p class="note error">{runs.error}</p>
{:else}
  <RunList runs={shown} now={ticker.now} showJob />
{/if}

<style lang="scss">
  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding-bottom: 1rem;
  }

  .filters {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;

    button {
      padding: 0.3rem 0.55rem;
      border: 1px dotted var(--line);

      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;

      opacity: 0.6;
      transition: opacity 0.15s ease;

      &:hover:not(:disabled) {
        opacity: 1;
      }

      &.active {
        opacity: 1;
        border-style: solid;
        border-color: currentcolor;
      }

      &:disabled {
        opacity: 0.25;
        cursor: default;
      }
    }
  }

  label {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    opacity: 0.6;

    select {
      padding: 0.15rem 0.3rem;
      border: 1px dotted var(--line);

      option {
        background: var(--bg-raised);
      }
    }
  }

  .updated {
    margin-left: auto;
    // A morph animates its own width, so the value is briefly wider than the
    // text it settles on. Without this the row pushes past the page edge.
    min-width: 0;
    overflow: hidden;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    opacity: 0.45;

    .stale {
      color: var(--warn);
      opacity: 0.9;
    }
  }

  .note {
    opacity: 0.5;
    padding: 2rem 0;
  }

  .error {
    color: var(--fail);
    opacity: 0.9;
    overflow-wrap: anywhere;
  }
</style>
