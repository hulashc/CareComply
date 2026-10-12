import {
  addDays,
  dayNumber,
  isoWeekdayOf,
  londonWallClockToInstant,
  parseCalendarDate,
  toDateString,
} from "../dates/london";
import type { SeriesFrequency } from "./types";

// Recurrence is calendar arithmetic on London dates (no timezone involved); only converting an
// occurrence to an instant uses London wall-clock time. That is what keeps an 08:00 visit at 08:00
// across the BST/GMT changes.

export interface RecurrenceRule {
  frequency: SeriesFrequency;
  repeat_every: number;
  /** ISO weekdays 1 (Mon) - 7 (Sun); used by 'custom' only. */
  by_weekday: number[];
  start_date: string;
  until_date: string | null;
}

/** Guard against runaway loops; callers also cap how many occurrences they accept. */
const MAX_SPAN_DAYS = 1100;

/**
 * Does `date` (YYYY-MM-DD) fall on the rule?
 *  daily  = every N days from start_date
 *  weekly = every N weeks, on the weekday of start_date
 *  custom = every N weeks (Mon-Sun weeks counted from start_date's week), on the chosen weekdays
 */
export function matchesRule(rule: RecurrenceRule, date: string): boolean {
  if (date < rule.start_date) return false;
  if (rule.until_date && date > rule.until_date) return false;
  const day = parseCalendarDate(date);
  const start = parseCalendarDate(rule.start_date);
  const diff = dayNumber(day) - dayNumber(start);
  const n = Math.max(1, rule.repeat_every);

  switch (rule.frequency) {
    case "daily":
      return diff % n === 0;
    case "weekly":
      return diff % 7 === 0 && (diff / 7) % n === 0;
    case "custom": {
      if (!rule.by_weekday.includes(isoWeekdayOf(day))) return false;
      const startMonday = dayNumber(start) - (isoWeekdayOf(start) - 1);
      const weekIndex = Math.floor((dayNumber(day) - startMonday) / 7);
      return weekIndex % n === 0;
    }
  }
}

/** Occurrence dates within [from, to] (inclusive), minus excluded dates, in ascending order. */
export function occurrenceDates(rule: RecurrenceRule, from: string, to: string, excluded: string[] = []): string[] {
  const first = from > rule.start_date ? from : rule.start_date;
  const last = rule.until_date && rule.until_date < to ? rule.until_date : to;
  if (first > last) return [];
  const span = dayNumber(parseCalendarDate(last)) - dayNumber(parseCalendarDate(first));
  if (span > MAX_SPAN_DAYS) throw new Error(`Recurrence range too long (${span} days)`);

  const skip = new Set(excluded);
  const out: string[] = [];
  let cursor = parseCalendarDate(first);
  for (let i = 0; i <= span; i++) {
    const s = toDateString(cursor);
    if (!skip.has(s) && matchesRule(rule, s)) out.push(s);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** "HH:mm" (also accepts "HH:mm:ss" from Postgres time columns). */
export function hhmm(value: string): string {
  return value.slice(0, 5);
}

function toMinutes(time: string): number {
  const [h, m] = hhmm(time).split(":").map(Number);
  return h * 60 + m;
}

/**
 * Minutes from start to end on the wall clock. An end at or before the start means the visit runs
 * past midnight (22:00 -> 06:00 = 480). Returns 0 when start equals end, which callers reject.
 */
export function durationBetween(startTime: string, endTime: string): number {
  const diff = toMinutes(endTime) - toMinutes(startTime);
  if (diff === 0) return 0;
  return diff > 0 ? diff : diff + 1440;
}

/**
 * The instants of a visit that starts at London wall-clock `startTime` on `date`. The end is
 * start + duration in real minutes, so a visit over a clock change keeps its true length.
 */
export function visitWindow(date: string, startTime: string, durationMinutes: number): { start: Date; end: Date } {
  const [h, m] = hhmm(startTime).split(":").map(Number);
  const start = londonWallClockToInstant(parseCalendarDate(date), h, m);
  return { start, end: new Date(start.getTime() + durationMinutes * 60_000) };
}
