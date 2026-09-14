<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { fetchJob, fetchRuns } from "$lib/api";
  import {
    formatAbsolute,
    formatCount,
    formatCountdown,
    formatDuration,
    scheduleTitle
  } from "$lib/format";
  import { createPoll, createTicker } from "$lib/poll.svelte";
  import { refresh } from "$lib/refresh.svelte";
  import { TextMorph } from "torph/svelte";

  import OutcomeTag from "$lib/components/OutcomeTag.svelte";
  import RunList from "$lib/components/RunList.svelte";
  import Tag from "$lib/components/Tag.svelte";

  /** How many history rows to ask for. The server clamps anything above 500. */
  const LIMITS = [25, 50, 100, 200] as const;

  const name = $derived(page.params.name ?? "");

  const job = createPoll((signal) => fetchJob(name, signal));
  const runs = createPoll((signal) => fetchRuns(name, limit, signal));
  const ticker = createTicker();

  let limit = $state(50);

  const missing = $derived(job.error !== undefined && job.data === undefined);

  $effect(() => ticker.start());

  $effect(() => {
    void name;
    return job.start(refresh.ms);
  });

  $effect(() => {
    void name;
    void limit;
    return runs.start(refresh.ms);
  });
</script>

<svelte:head>
  <title>{name} - vps-cron</title>
</svelte:head>

<a class="back" href={resolve("/")}>all jobs</a>

{#if job.loading && job.data === undefined}
  <p class="note">Loading...</p>
{:else if missing}
  <p class="note error">{job.error}</p>
{:else if job.data}
  {@const status = job.data}

  <header class="title">
    <h1><TextMorph text={status.name} /></h1>

    <div class="tags">
      {#if status.running}
        <Tag color="var(--live)" pulse>running</Tag>
      {/if}
      {#if !status.enabled}
        <Tag color="var(--idle)">disabled</Tag>
      {/if}
      {#if status.last_run}
        <OutcomeTag outcome={status.last_run.outcome} />
      {/if}
    </div>
  </header>

  <dl class="meta">
    <div>
      <dt>schedule</dt>
      <dd class="tabular schedule" title={scheduleTitle(status.schedule)}>
        <TextMorph numbers={false} text={status.schedule} />
      </dd>
    </div>

    <div>
      <dt>next run</dt>
      <dd>
        {#if status.next_run}
          <time datetime={status.next_run} title={formatAbsolute(status.next_run)}>
            <TextMorph text={formatCountdown(status.next_run, ticker.now)} />
          </time>
        {:else}
          <span class="none">never</span>
        {/if}
      </dd>
    </div>

    <div>
      <dt>runs since startup</dt>
      <dd class="tabular">
        <TextMorph text={formatCount(status.total_runs)} />
        {#if status.total_failures > 0}
          <span class="bad">
            <TextMorph text="{formatCount(status.total_failures)} failed" />
          </span>
        {/if}
        {#if status.total_skipped > 0}
          <span class="dim">
            <TextMorph text="{formatCount(status.total_skipped)} skipped" />
          </span>
        {/if}
      </dd>
    </div>

    <div>
      <dt>last duration</dt>
      <dd class="tabular">
        {#if status.last_run}
          <TextMorph text={formatDuration(status.last_run.duration_ms)} />
        {:else}
          <span class="none">-</span>
        {/if}
      </dd>
    </div>

    <div class="wide">
      <dt>kind</dt>
      <dd class="kind"><TextMorph text={status.kind} /></dd>
    </div>
  </dl>

  <section class="history">
    <header>
      <h2>history</h2>

      <label>
        <span>last</span>
        <select bind:value={limit}>
          {#each LIMITS as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
    </header>

    {#if runs.error && runs.data === undefined}
      <p class="note error">{runs.error}</p>
    {:else}
      <RunList runs={runs.data ?? []} now={ticker.now} />
    {/if}
  </section>
{/if}

<style lang="scss">
  .back {
    display: inline-block;
    margin-bottom: 1.25rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.5;

    &::before {
      content: "< ";
    }

    &:hover {
      opacity: 1;
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

  .title {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;

    h1 {
      font-size: 1.5rem;
      font-weight: 500;
      overflow-wrap: anywhere;
    }
  }

  .tags {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 1rem;
    margin: 1.5rem 0 2.5rem;
    padding: 1rem 1.15rem;
    border: 1px dotted var(--line);
    background: var(--bg-raised);
    font-size: 0.85rem;

    .wide {
      grid-column: 1 / -1;
    }
  }

  dt {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.45;
  }

  dd {
    overflow-wrap: anywhere;
  }

  .schedule {
    // The expression is what jobs.toml says; the tooltip says what it means.
    cursor: help;
  }

  .kind {
    opacity: 0.8;
    // The value is one unbroken line, and a long shell_file path is longer than
    // a phone. Scroll that one field rather than the page, and fade the edge so
    // it reads as more text rather than a cut.
    overflow-x: auto;
    mask-image: linear-gradient(to right, #000 calc(100% - 2rem), transparent);
  }

  .dim {
    opacity: 0.55;
  }

  .none {
    opacity: 0.35;
  }

  .bad {
    color: var(--fail);
  }

  .history > header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.5rem;

    h2 {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      opacity: 0.5;
      font-weight: 500;
    }

    label {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      opacity: 0.6;
    }

    select {
      padding: 0.15rem 0.3rem;
      border: 1px dotted var(--line);

      option {
        background: var(--bg-raised);
      }
    }
  }
</style>
