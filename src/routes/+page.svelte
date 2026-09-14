<script lang="ts">
  import { page } from "$app/state";

  import type { JobStatus } from "$lib/api";
  import { API_BASE, fetchHealth, fetchJobs } from "$lib/api";
  import { formatRelative } from "$lib/format";
  import { createPoll, createTicker } from "$lib/poll.svelte";
  import { refresh } from "$lib/refresh.svelte";
  import { TextMorph } from "torph/svelte";

  import JobCard from "$lib/components/JobCard.svelte";
  import Tag from "$lib/components/Tag.svelte";

  /** The four ways of narrowing the board, in the order the buttons show them. */
  const FILTERS = ["all", "failing", "running", "disabled"] as const;

  type Filter = (typeof FILTERS)[number];

  const health = createPoll((signal) => fetchHealth(signal));
  const jobs = createPoll((signal) => fetchJobs(signal));
  const ticker = createTicker();

  let filter = $state<Filter>("all");

  const isFailing = (job: JobStatus): boolean =>
    job.last_run !== null &&
    (job.last_run.outcome === "failure" || job.last_run.outcome === "timeout");

  const all = $derived(jobs.data ?? []);

  const counts = $derived({
    all: all.length,
    failing: all.filter((job) => isFailing(job)).length,
    running: all.filter((job) => job.running).length,
    disabled: all.filter((job) => !job.enabled).length
  });

  const shown = $derived(
    all.filter((job) => {
      switch (filter) {
        case "failing": {
          return isFailing(job);
        }
        case "running": {
          return job.running;
        }
        case "disabled": {
          return !job.enabled;
        }
        default: {
          return true;
        }
      }
    })
  );

  /** Nothing at all came back, so there is no board to draw. */
  const dead = $derived(jobs.error !== undefined && jobs.data === undefined);

  /**
   * Whether the failure can be a CORS one. A cross-origin request leaves, the
   * status server answers it, and the browser then refuses to hand the response
   * to the page, which from here is indistinguishable from a dead server. It is
   * by far the likelier of the two when the base is someone else's origin.
   */
  const crossOrigin = $derived(
    API_BASE.startsWith("http") && !API_BASE.startsWith(page.url.origin)
  );

  $effect(() => ticker.start());
  $effect(() => health.start(refresh.ms));
  $effect(() => jobs.start(refresh.ms));
</script>

{#if jobs.loading && jobs.data === undefined}
  <p class="note">Loading...</p>
{:else if dead}
  <section class="dead">
    <h2>The status server is not answering.</h2>
    <p>{jobs.error}</p>
    {#if crossOrigin}
      <p class="hint">
        <code>{API_BASE}</code> is another origin, so the browser only hands the response to this
        page if the API answers with <code>Access-Control-Allow-Origin</code> for
        <code>{page.url.origin}</code>. Until it does, the request goes out and the answer is thrown
        away. Serving this site from the API's own origin avoids the question entirely.
      </p>
    {:else}
      <p class="hint">
        It binds to <code>127.0.0.1:8787</code> by default, so from anywhere else it needs a tunnel:
        <code>ssh -N -L 8787:127.0.0.1:8787 your-vps</code>
      </p>
    {/if}
  </section>
{:else}
  <section class="health">
    {#if health.data}
      <Tag color={health.data.status === "ok" ? "var(--ok)" : "var(--fail)"}>
        <TextMorph text={health.data.status} />
      </Tag>
    {/if}

    <div class="filters">
      {#each FILTERS as option (option)}
        <button
          type="button"
          class:active={filter === option}
          disabled={option !== "all" && counts[option] === 0}
          onclick={() => (filter = option)}
        >
          {option}
          <span class="count tabular">
            <TextMorph text={String(counts[option])} />
          </span>
        </button>
      {/each}
    </div>

    <p class="updated">
      {#if jobs.error}
        <span class="stale">stale: {jobs.error}</span>
      {:else if jobs.updatedAt}
        updated <TextMorph
          text={formatRelative(new Date(jobs.updatedAt).toISOString(), ticker.now)}
        />
      {/if}
    </p>
  </section>

  {#if shown.length === 0}
    <p class="note">Nothing matches this filter.</p>
  {:else}
    <div class="grid">
      {#each shown as job (job.name)}
        <JobCard {job} now={ticker.now} />
      {/each}
    </div>
  {/if}
{/if}

<style lang="scss">
  .note {
    opacity: 0.5;
    padding: 2rem 0;
  }

  .dead {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border: 1px dotted color-mix(in srgb, var(--fail) 60%, transparent);
    background: var(--bg-raised);

    h2 {
      font-size: 1rem;
      font-weight: 500;
      color: var(--fail);
    }

    p {
      font-size: 0.85rem;
      opacity: 0.75;
      overflow-wrap: anywhere;
    }

    .hint {
      line-height: 1.7;

      code {
        font: inherit;
        padding: 0.1em 0.3em;
        border: 1px dotted var(--line);
      }
    }
  }

  .health {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding-bottom: 1.25rem;
  }

  .filters {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;

    button {
      display: inline-flex;
      align-items: baseline;
      gap: 0.4rem;

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

    .count {
      opacity: 0.6;
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

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
    gap: 1rem;
  }
</style>
