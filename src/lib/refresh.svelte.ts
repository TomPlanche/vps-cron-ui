/**
 * How often the pages re-poll, chosen once in the header and read everywhere.
 *
 * A module-level rune rather than a prop chain: the setting belongs to the
 * session, not to any one page, and it has to survive navigation.
 */

/** The intervals the header offers. `0` pauses polling. */
export const REFRESH_OPTIONS: readonly { label: string; ms: number }[] = [
  { label: "1 s", ms: 1000 },
  { label: "5 s", ms: 5000 },
  { label: "15 s", ms: 15_000 },
  { label: "1 min", ms: 60_000 },
  { label: "paused", ms: 0 }
];

export const refresh = $state({ ms: 5000 });
