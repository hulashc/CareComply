import {
  addDays,
  isoWeekdayOf,
  londonMidnight,
  parseCalendarDate,
  toDateString,
  type CalendarDate,
} from "../dates/london";
import type { RosterView } from "./types";

// Which dates each view loads and shows. All London calendar dates (YYYY-MM-DD); the instants
// come from londonMidnight so a 23- or 25-hour day on a clock change is exact.

export interface ViewRange {
  /** First and last date, inclusive. */
  from: string;
  to: string;
  start: Date;
  end: Date;
  /** Every date in the range. */
  days: string[];
}

const mondayOf = (d: CalendarDate): CalendarDate => addDays(d, 1 - isoWeekdayOf(d));

function build(first: CalendarDate, count: number): ViewRange {
  const days = Array.from({ length: count }, (_, i) => toDateString(addDays(first, i)));
  return {
    from: days[0],
    to: days[count - 1],
    start: londonMidnight(first),
    end: londonMidnight(addDays(first, count)),
    days,
  };
}

/** Day = one date. Week / timeline / client = Monday-Sunday. Month = the 6-week grid (42 days). */
export function rangeFor(view: RosterView, date: string): ViewRange {
  const d = parseCalendarDate(date);
  switch (view) {
    case "day":
      return build(d, 1);
    case "month":
      return build(mondayOf({ year: d.year, month: d.month, day: 1 }), 42);
    default:
      return build(mondayOf(d), 7);
  }
}

/** Move the anchor date by one view-sized step. */
export function stepDate(view: RosterView, date: string, direction: 1 | -1): string {
  const d = parseCalendarDate(date);
  if (view === "day") return toDateString(addDays(d, direction));
  if (view === "month") {
    const m = d.month - 1 + direction;
    const year = d.year + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12 + 1;
    return toDateString({ year, month, day: 1 });
  }
  return toDateString(addDays(d, 7 * direction));
}

/** Human title for the toolbar, e.g. "12 – 18 Oct 2026". */
export function rangeTitle(view: RosterView, date: string): string {
  const fmt = (s: string, opts: Intl.DateTimeFormatOptions) => {
    const c = parseCalendarDate(s);
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(c.year, c.month - 1, c.day)));
  };
  if (view === "day") return fmt(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (view === "month") return fmt(date, { month: "long", year: "numeric" });
  const r = rangeFor(view, date);
  return `${fmt(r.from, { day: "numeric" })} – ${fmt(r.to, { day: "numeric", month: "short", year: "numeric" })}`;
}
