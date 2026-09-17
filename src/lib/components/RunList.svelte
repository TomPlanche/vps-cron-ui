<script lang="ts">
  import { resolve } from "$app/paths";

  import type { RunRecord } from "$lib/api";
  import { formatAbsolute, formatDuration, formatRelative } from "$lib/format";
  import { TextMorph } from "torph/svelte";

  import OutcomeTag from "$lib/components/OutcomeTag.svelte";
  import Tag from "$lib/components/Tag.svelte";

  type Props = {
    runs: RunRecord[];
    /** The page's clock. */
    now: number;
    /** Show which job each run belongs to. Off on a single job's own page. */
    showJob?: boolean;
  };

  let { runs, now, showJob = false }: Props = $props();

  /** The history keeps no id, so a run is identified by its job and start. */
  const keyOf = (run: RunRecord): string => `${run.job}@${run.started_at}`;
</script>

{#if runs.length === 0}
  <p class="empty">No runs recorded yet.</p>
{:else}
  <ul class="runs">
    {#each runs as run (keyOf(run))}
      <li>
        <div class="head">
          <OutcomeTag outcome={run.outcome} />

          {#if run.trigger === "manual"}
            <Tag color="var(--idle)">manual</Tag>
          {/if}

          {#if showJob}
            <a class="job" href={resolve("/job/[name]", { name: run.job })}>{run.job}</a>
          {/if}

          <time datetime={run.started_at} title={formatAbsolute(run.started_at)}>
            <TextMorph text={formatRelative(run.started_at, now)} />
          </time>

          <span class="duration tabular">{formatDuration(run.duration_ms)}</span>
        </div>

        <p class="summary">{run.summary}</p>

        {#if run.output}
          <details>
            <summary>output</summary>
            <pre>{run.output}</pre>
          </details>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style lang="scss">
  .empty {
    opacity: 0.5;
    padding: 1rem 0;
  }

  .runs {
    display: flex;
    flex-direction: column;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.7rem 0;
    border-bottom: 1px dotted var(--line);
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .job {
    letter-spacing: 0.02em;
    border-bottom: 1px dotted transparent;

    &:hover {
      border-bottom-color: currentcolor;
    }
  }

  time {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .duration {
    font-size: 0.8rem;
    opacity: 0.6;
    margin-left: auto;
  }

  .summary {
    font-size: 0.85rem;
    opacity: 0.8;
    overflow-wrap: anywhere;
  }

  details {
    font-size: 0.8rem;

    summary {
      cursor: pointer;
      opacity: 0.5;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.65rem;
      width: fit-content;

      &:hover {
        opacity: 0.9;
      }
    }

    pre {
      margin-top: 0.5rem;
      padding: 0.75rem 0.9rem;
      border: 1px dotted var(--line);
      background: var(--bg-raised);
      max-height: 22rem;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      opacity: 0.85;
    }
  }
</style>
