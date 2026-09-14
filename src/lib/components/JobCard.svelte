<script lang="ts">
  import { resolve } from "$app/paths";

  import type { JobStatus } from "$lib/api";
  import {
    formatAbsolute,
    formatCount,
    formatCountdown,
    formatDuration,
    formatRelative,
    scheduleTitle,
    truncate
  } from "$lib/format";
  import { TextMorph } from "torph/svelte";

  import OutcomeTag from "$lib/components/OutcomeTag.svelte";
  import Tag from "$lib/components/Tag.svelte";

  type Props = {
    job: JobStatus;
    /** The page's clock, so every card counts down off the same instant. */
    now: number;
  };

  let { job, now }: Props = $props();

  const failing = $derived(
    job.last_run !== null &&
      (job.last_run.outcome === "failure" || job.last_run.outcome === "timeout")
  );
</script>

<article class="card" class:card--failing={failing} class:card--off={!job.enabled}>
  <a href={resolve("/job/[name]", { name: job.name })}>
    <header>
      <h2>{job.name}</h2>

      <div class="tags">
        {#if job.running}
          <Tag color="var(--live)" pulse>running</Tag>
        {/if}
        {#if !job.enabled}
          <Tag color="var(--idle)">disabled</Tag>
        {/if}
        {#if job.last_run}
          <OutcomeTag outcome={job.last_run.outcome} />
        {:else}
          <Tag color="var(--idle)">no run yet</Tag>
        {/if}
      </div>
    </header>

    <p class="kind" title={job.kind}><TextMorph text={truncate(job.kind, 90)} /></p>

    <dl>
      <div>
        <dt>schedule</dt>
        <dd class="tabular schedule" title={scheduleTitle(job.schedule)}>
          <TextMorph numbers={false} text={job.schedule} />
        </dd>
      </div>

      <div>
        <dt>next</dt>
        <dd>
          {#if job.next_run}
            <time datetime={job.next_run} title={formatAbsolute(job.next_run)}>
              <TextMorph text={formatCountdown(job.next_run, now)} />
            </time>
          {:else}
            <span class="none">never</span>
          {/if}
        </dd>
      </div>

      <div>
        <dt>last</dt>
        <dd>
          {#if job.last_run}
            <time
              datetime={job.last_run.started_at}
              title={formatAbsolute(job.last_run.started_at)}
            >
              <TextMorph text={formatRelative(job.last_run.started_at, now)} />
            </time>
            <span class="dim">
              <TextMorph text="took {formatDuration(job.last_run.duration_ms)}" />
            </span>
          {:else}
            <span class="none">-</span>
          {/if}
        </dd>
      </div>

      <div>
        <dt>runs</dt>
        <dd class="tabular">
          <TextMorph text={formatCount(job.total_runs)} />
          {#if job.total_failures > 0}
            <span class="bad">
              <TextMorph text="{formatCount(job.total_failures)} failed" />
            </span>
          {/if}
          {#if job.total_skipped > 0}
            <span class="dim">
              <TextMorph text="{formatCount(job.total_skipped)} skipped" />
            </span>
          {/if}
        </dd>
      </div>
    </dl>

    {#if job.last_run}
      <p class="summary" title={job.last_run.summary}>
        <TextMorph text={truncate(job.last_run.summary, 90)} />
      </p>
    {/if}
  </a>
</article>

<style lang="scss">
  .card a {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: 100%;

    padding: 1rem 1.15rem;
    border: 1px dotted var(--line);
    background: var(--bg-raised);

    opacity: 0.9;
    transition:
      opacity 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      opacity: 1;
      border-style: solid;
      border-color: currentcolor;
    }
  }

  .card--failing a {
    border-color: color-mix(in srgb, var(--fail) 55%, transparent);
  }

  .card--off a {
    opacity: 0.55;
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  h2 {
    font-size: 1.05rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    overflow-wrap: anywhere;
  }

  .tags {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .kind,
  .summary {
    // A morph lays its value out on one line, so these cannot wrap. What does
    // not fit fades out at the edge instead of being cut through a glyph, and
    // the title carries the whole value either way.
    overflow: hidden;
    mask-image: linear-gradient(to right, #000 calc(100% - 2rem), transparent);
  }

  .kind {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem 1rem;
    font-size: 0.8rem;
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

  .dim {
    opacity: 0.55;
    white-space: nowrap;
  }

  .none {
    opacity: 0.35;
  }

  .bad {
    color: var(--fail);
  }

  .summary {
    margin-top: auto;
    font-size: 0.78rem;
    opacity: 0.6;
  }
</style>
