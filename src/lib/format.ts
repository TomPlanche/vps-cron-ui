/** Formatting for the three things this dashboard shows: times, durations and outcomes. */

import type { Outcome } from "$lib/api";

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const ABSOLUTE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium"
});

/** Units the relative formatter walks, largest first. */
const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000]
];

/**
 * "3 minutes ago", "in 42 seconds".
 *
 * `now` is passed in rather than read from the clock so a list of a hundred
 * rows shares one instant, and so a single ticker re-renders all of them.
 */
export const formatRelative = (iso: string, now: number): string => {
  const delta = Date.parse(iso) - now;
  if (Number.isNaN(delta)) {
    return "unknown";
  }

  for (const [unit, ms] of UNITS) {
    if (Math.abs(delta) >= ms) {
      return RELATIVE.format(Math.round(delta / ms), unit);
    }
  }

  return "just now";
};

/**
 * Same as `formatRelative`, but for an instant that is supposed to be ahead.
 *
 * The scheduler computes the next occurrence when a run finishes, so a job on a
 * five second schedule spends part of its life with `next_run` a moment in the
 * past. "4 seconds ago" reads like a fault there; it is just a job that is due.
 */
export const formatCountdown = (iso: string, now: number): string => {
  const delta = Date.parse(iso) - now;
  if (Number.isNaN(delta)) {
    return "unknown";
  }

  return delta <= 0 ? "due" : formatRelative(iso, now);
};

/**
 * Cuts a one-line field down to something that fits on it.
 *
 * A morphing value is laid out on one line by construction, so the CSS ellipsis
 * that used to shorten these has nothing to bite on. Cutting the string instead
 * keeps the line honest, and every caller puts the whole text in a `title`.
 */
export const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;

/** Run counters reach six figures on a five second schedule. */
const COUNT = new Intl.NumberFormat("en-GB");

/** "97,258" rather than "97258". */
export const formatCount = (value: number): string => COUNT.format(value);

/** The full timestamp, for a `title` attribute. */
export const formatAbsolute = (iso: string): string => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : ABSOLUTE.format(parsed);
};

/** "820 ms", "4.10 s", "2 m 07 s", "1 h 12 m". */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} m ${String(Math.floor(seconds % 60)).padStart(2, "0")} s`;
  }

  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} m`;
};

/** The colour every outcome is shown in, as a CSS custom property. */
export const OUTCOME_COLORS: Record<Outcome, string> = {
  success: "var(--ok)",
  failure: "var(--fail)",
  timeout: "var(--warn)",
  skipped: "var(--idle)"
};

/**
 * The six-field cron expression, spaced out so the fields line up with the
 * legend the tooltip gives.
 */
export const SCHEDULE_FIELDS = "second minute hour day month weekday";

/**
 * A six-field cron expression in words.
 *
 * Reading `0 15 * * * *` correctly means knowing which field is which, that the
 * leading one is seconds rather than minutes, and that the weekday ordinals
 * start at Sunday. The schedule stays on screen as written, since that is what
 * `jobs.toml` says; this is what the tooltip adds.
 *
 * Anything it cannot describe with certainty returns an empty string, so a
 * schedule is either explained correctly or not at all.
 */

/** Weekday ordinals as the `cron` crate reads them: 1 is Sunday, 7 is Saturday. */
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

/** The names the crate accepts in a field, keyed by their first three letters. */
const named = (names: readonly string[]): Map<string, number> => {
  const lookup = new Map<string, number>();
  names.forEach((name, index) => {
    lookup.set(name.toLowerCase(), index + 1);
    lookup.set(name.slice(0, 3).toLowerCase(), index + 1);
  });
  return lookup;
};

const WEEKDAY_NAMES = named(WEEKDAYS);
const MONTH_NAMES = named(MONTHS);

/** One parsed field of the expression. */
type Field =
  | { kind: "any" }
  | { kind: "step"; step: number }
  | { kind: "values"; values: number[] }
  | { kind: "range"; from: number; to: number }
  | { kind: "unknown" };

/** Reads one ordinal, by number or by the name the crate allows for it. */
const ordinal = (raw: string, names?: Map<string, number>): number | undefined => {
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  return names?.get(raw.toLowerCase());
};

const parseField = (raw: string, names?: Map<string, number>): Field => {
  if (raw === "*" || raw === "?") {
    return { kind: "any" };
  }

  const step = /^(?:\*|\d+)\/(\d+)$/.exec(raw);
  if (step) {
    return { kind: "step", step: Number(step[1]) };
  }

  const range = raw.split("-");
  if (range.length === 2) {
    const from = ordinal(range[0], names);
    const to = ordinal(range[1], names);
    return from !== undefined && to !== undefined
      ? { kind: "range", from, to }
      : { kind: "unknown" };
  }

  const values = raw.split(",").map((value) => ordinal(value, names));
  return values.every((value) => value !== undefined)
    ? { kind: "values", values }
    : { kind: "unknown" };
};

/** "0, 15 and 30". */
const joinWords = (words: string[]): string =>
  words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;

const weekdayName = (value: number): string => WEEKDAYS[(value - 1) % 7] ?? String(value);
const monthName = (value: number): string => MONTHS[(value - 1) % 12] ?? String(value);

/** The single value of a field, when it has exactly one. */
const only = (field: Field): number | undefined =>
  field.kind === "values" && field.values.length === 1 ? field.values[0] : undefined;

const pad = (value: number): string => String(value).padStart(2, "0");

/** Which days the schedule runs on: "every Monday", "day 1 of every month". */
const dayPhrase = (day: Field, month: Field, weekday: Field): string => {
  const months = month.kind === "values" ? joinWords(month.values.map((v) => monthName(v))) : "";

  if (weekday.kind === "values") {
    const days = `every ${joinWords(weekday.values.map((v) => weekdayName(v)))}`;
    return months ? `${days} in ${months}` : days;
  }

  if (weekday.kind === "range") {
    const days = `${weekdayName(weekday.from)} to ${weekdayName(weekday.to)}`;
    return months ? `${days} in ${months}` : days;
  }

  if (day.kind === "values") {
    const days = joinWords(day.values.map((v) => String(v)));
    return months ? `day ${days} of ${months}` : `day ${days} of every month`;
  }

  return months ? `every day in ${months}` : "every day";
};

/** What a schedule that runs more than once a day adds about its days. */
const dayQualifier = (day: Field, month: Field, weekday: Field): string => {
  const phrase = dayPhrase(day, month, weekday);
  if (phrase === "every day") {
    return "";
  }

  // "every day in March" is a qualifier about the month alone.
  return phrase.startsWith("every day in ")
    ? `, ${phrase.slice("every day ".length)}`
    : `, ${phrase}`;
};

/**
 * A six-field cron expression in words: `0 15 * * * *` is "every hour, at 15
 * minutes past", not "every 15 minutes".
 *
 * Reading one correctly means knowing which field is which, that the leading
 * field is seconds rather than minutes, and that weekday ordinals start at
 * Sunday. The expression stays on screen as written, since that is what
 * `jobs.toml` says; this is what the tooltip adds.
 *
 * Anything it cannot describe with certainty returns an empty string, so a
 * schedule is either explained correctly or not explained at all.
 */
export const describeSchedule = (expression: string): string => {
  const raw = expression.trim().split(/\s+/);
  // Six fields, or seven with the optional trailing year.
  if (raw.length < 6 || raw.length > 7) {
    return "";
  }

  const [second, minute, hour] = raw.slice(0, 3).map((field) => parseField(field));
  const day = parseField(raw[3]);
  const month = parseField(raw[4], MONTH_NAMES);
  const weekday = parseField(raw[5], WEEKDAY_NAMES);

  // Field by field rather than a loop, so the narrowing survives into the
  // branches below: past this point no field is an expression we cannot read.
  if (
    second.kind === "unknown" ||
    minute.kind === "unknown" ||
    hour.kind === "unknown" ||
    day.kind === "unknown" ||
    month.kind === "unknown" ||
    weekday.kind === "unknown"
  ) {
    return "";
  }

  const days = dayQualifier(day, month, weekday);

  if (second.kind === "any") {
    return `every second${days}`;
  }

  if (second.kind === "step") {
    return `every ${second.step} seconds${days}`;
  }

  if (second.kind === "range" || only(second) === undefined) {
    return "";
  }

  if (minute.kind === "any") {
    return `every minute${days}`;
  }

  if (minute.kind === "step") {
    return minute.step === 1 ? `every minute${days}` : `every ${minute.step} minutes${days}`;
  }

  if (minute.kind === "range") {
    return "";
  }

  if (hour.kind === "range") {
    return "";
  }

  if (hour.kind === "any" || hour.kind === "step") {
    const every = hour.kind === "step" ? `every ${hour.step} hours` : "every hour";
    const past =
      only(minute) === 0
        ? "on the hour"
        : `at ${joinWords(minute.values.map((v) => String(v)))} minutes past`;

    return `${every}, ${past}${days}`;
  }

  const minutes = only(minute);
  const seconds = only(second) ?? 0;
  if (minutes === undefined) {
    return "";
  }

  const times = hour.values.map((value) =>
    seconds === 0
      ? `${pad(value)}:${pad(minutes)}`
      : `${pad(value)}:${pad(minutes)}:${pad(seconds)}`
  );

  return `${dayPhrase(day, month, weekday)} at ${joinWords(times)}`;
};

/** The tooltip a schedule carries: what it means, then which field is which. */
export const scheduleTitle = (expression: string): string => {
  const described = describeSchedule(expression);
  return described ? `${described}\n(${SCHEDULE_FIELDS})` : SCHEDULE_FIELDS;
};
