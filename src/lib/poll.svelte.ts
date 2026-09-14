/** Polling and clock primitives, shared by every page. */

/** A poll of one endpoint: its latest value, its latest failure, and a timer. */
export type Poll<T> = {
  /** The most recent successful response, kept across a failed refresh. */
  readonly data: T | undefined;
  /** The last failure, cleared by the next success. */
  readonly error: string | undefined;
  /** True until the first response, success or failure, has landed. */
  readonly loading: boolean;
  /** When the last success landed. */
  readonly updatedAt: number | undefined;
  /** Fetches once, now. */
  refresh: () => Promise<void>;
  /**
   * Fetches once, then every `intervalMs` until the returned teardown runs.
   * An interval of `0` fetches once and leaves it there.
   */
  start: (intervalMs: number) => () => void;
};

/**
 * Polls one endpoint.
 *
 * The previous value survives a failed refresh on purpose: a dashboard that
 * blanks out the moment the tunnel hiccups is worse than one showing data with
 * a visible "stale" marker next to it.
 */
export const createPoll = <T>(load: (signal: AbortSignal) => Promise<T>): Poll<T> => {
  let data = $state<T | undefined>(undefined);
  let error = $state<string | undefined>(undefined);
  let loading = $state(true);
  let updatedAt = $state<number | undefined>(undefined);

  let inFlight: AbortController | undefined;

  const refresh = async (): Promise<void> => {
    inFlight?.abort();

    const controller = new AbortController();
    inFlight = controller;

    try {
      const next = await load(controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      data = next;
      error = undefined;
      updatedAt = Date.now();
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }

      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (!controller.signal.aborted) {
        loading = false;
      }
    }
  };

  const start = (intervalMs: number): (() => void) => {
    void refresh();

    if (intervalMs <= 0) {
      return () => inFlight?.abort();
    }

    const timer = setInterval(() => void refresh(), intervalMs);

    return () => {
      clearInterval(timer);
      inFlight?.abort();
    };
  };

  return {
    get data() {
      return data;
    },
    get error() {
      return error;
    },
    get loading() {
      return loading;
    },
    get updatedAt() {
      return updatedAt;
    },
    refresh,
    start
  };
};

/**
 * One clock for the whole page, so "in 4 seconds" counts down without every
 * component owning a timer of its own.
 */
export const createTicker = (intervalMs = 1000) => {
  let now = $state(Date.now());

  return {
    get now() {
      return now;
    },
    start: (): (() => void) => {
      const timer = setInterval(() => (now = Date.now()), intervalMs);
      return () => clearInterval(timer);
    }
  };
};
