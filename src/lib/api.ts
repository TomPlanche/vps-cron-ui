/**
 * The vps-cron status server, typed.
 *
 * Every shape here mirrors a Rust struct: `JobStatus` and `RunRecord` come from
 * `src/scheduler.rs` and `src/job.rs`, and the health payload from the
 * `/health` handler in `src/http.rs`. The API is read-only, so this module has
 * no mutating calls to make.
 */

/**
 * Where the requests go, from `VITE_API_BASE` in `.env`.
 *
 * A bare host is read as an origin, so `cron.tomplanche.com` and
 * `https://cron.tomplanche.com` mean the same thing rather than one of them
 * resolving to a path under this site.
 *
 * Left empty, it falls back to this site's own origin, which is what a build
 * served from the root of the status server's own host wants: the API owns
 * `/health`, `/jobs` and `/runs` there, and `vite.config.ts` proxies those
 * three paths in dev so the same relative URLs work.
 *
 * An absolute origin here is subject to CORS. The status server sends no
 * `Access-Control-Allow-Origin`, so until something in front of it does, the
 * browser refuses the response however reachable the API is from curl. The
 * README has the reverse proxy side of it.
 */
const configured = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");

export const API_BASE = /^[^/]+\.[^/]+$/.test(configured) ? `https://${configured}` : configured;

/** How a single run ended. Matches `Outcome` in `src/job.rs`. */
export type Outcome = "success" | "failure" | "timeout" | "skipped";

/** What started a run. Matches `Trigger` in `src/job.rs`. */
export type Trigger = "scheduled" | "manual";

/** A completed run, as stored in the history. */
export type RunRecord = {
  /** Name of the job that ran. */
  job: string;
  /** RFC 3339 start time. */
  started_at: string;
  /** RFC 3339 finish time. */
  finished_at: string;
  /** How long the run took. */
  duration_ms: number;
  /** How the run ended. */
  outcome: Outcome;
  /** What started this run. */
  trigger: Trigger;
  /** Single-line summary, or the error message for a failed run. */
  summary: string;
  /** Captured output tail, if the run produced any. */
  output: string | null;
};

/** What the status server reports about one job. */
export type JobStatus = {
  /** The job name from the jobs file. */
  name: string;
  /** Its six-field cron expression. */
  schedule: string;
  /** A short description of what it runs. */
  kind: string;
  /** Whether the scheduler is running it at all. */
  enabled: boolean;
  /** Whether a run is in flight right now. */
  running: boolean;
  /** When the next occurrence is due, for enabled jobs. */
  next_run: string | null;
  /** The most recent finished run. */
  last_run: RunRecord | null;
  /** How many runs have executed since the scheduler started. */
  total_runs: number;
  /** How many of those failed or timed out. */
  total_failures: number;
  /** How many occurrences were skipped because a run was still going. */
  total_skipped: number;
};

/** Liveness, plus the names of any jobs whose last run was a problem. */
export type Health = {
  status: "ok" | "degraded";
  jobs: number;
  enabled: number;
  running: number;
  failing: string[];
};

/** The origin the requests actually go to when no base is configured. */
const pageOrigin = (): string => (typeof location === "undefined" ? "" : location.origin);

/**
 * One request, with the failure modes turned into messages worth showing.
 *
 * A dead tunnel and a 404 read very differently to whoever is looking at the
 * screen, and neither is worth a stack trace.
 */
const request = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal,
      headers: { accept: "application/json" }
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    // Down, unreachable and refused-by-CORS are one and the same to `fetch`,
    // so the message says what happened and the page says what it can mean.
    throw new Error(`No usable answer from ${API_BASE || pageOrigin()}${path}`, { cause });
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: unknown) =>
        typeof body === "object" && body !== null && "error" in body ? String(body.error) : ""
      )
      .catch(() => "");

    throw new Error(detail || `${response.status} ${response.statusText} on ${path}`);
  }

  return (await response.json()) as T;
};

/** `GET /health` */
export const fetchHealth = (signal?: AbortSignal): Promise<Health> =>
  request<Health>("/health", signal);

/** `GET /jobs`, unwrapped to the array. */
export const fetchJobs = async (signal?: AbortSignal): Promise<JobStatus[]> => {
  const body = await request<{ jobs: JobStatus[] }>("/jobs", signal);
  return body.jobs;
};

/** `GET /jobs/{name}` */
export const fetchJob = (name: string, signal?: AbortSignal): Promise<JobStatus> =>
  request<JobStatus>(`/jobs/${encodeURIComponent(name)}`, signal);

/** `GET /runs`, newest first. The server clamps `limit` to 500. */
export const fetchRuns = async (
  job: string | undefined,
  limit: number,
  signal?: AbortSignal
): Promise<RunRecord[]> => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (job !== undefined) {
    query.set("job", job);
  }

  const body = await request<{ runs: RunRecord[] }>(`/runs?${query}`, signal);
  return body.runs;
};
