// Europe/London calendar helpers. All "today / tomorrow / this week" logic on the
// dashboard goes through here so it is correct regardless of the server's timezone
// and across BST/GMT changes. Pure Intl — no date library.

export const LONDON_TZ = "Europe/London";

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface LondonParts extends CalendarDate {
  hour: number;
  minute: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday */
  weekday: number;
}

export interface InstantRange {
  /** Inclusive start (UTC instant) */
  start: Date;
  /** Exclusive end (UTC instant) */
  end: Date;
}

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function londonParts(instant: Date): LondonParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(instant)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: WEEKDAYS[map.weekday] ?? 1,
  };
}

/** Pure calendar arithmetic (no timezone involved). */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function toDateString(date: CalendarDate): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.year}-${mm}-${dd}`;
}

/** London offset from UTC in ms at a given instant (0 in GMT, +3_600_000 in BST). */
function londonOffsetMs(instant: Date): number {
  const p = londonParts(instant);
  const seconds = instant.getUTCSeconds();
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, seconds);
  return wallAsUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

/** The UTC instant at which the given London calendar date begins (00:00 London). */
export function londonMidnight(date: CalendarDate): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  let result = guess - londonOffsetMs(new Date(guess));
  // Re-check at the corrected instant in case the guess straddled a DST change.
  result = guess - londonOffsetMs(new Date(result));
  return new Date(result);
}

export function londonToday(now: Date = new Date()): CalendarDate {
  const { year, month, day } = londonParts(now);
  return { year, month, day };
}

/** London hour 0-23 (e.g. for the greeting). */
export function londonHour(now: Date = new Date()): number {
  return londonParts(now).hour;
}

/** [00:00, next 00:00) London for today + offsetDays. */
export function londonDayRange(offsetDays: number, now: Date = new Date()): InstantRange & { date: string } {
  const day = addDays(londonToday(now), offsetDays);
  return {
    date: toDateString(day),
    start: londonMidnight(day),
    end: londonMidnight(addDays(day, 1)),
  };
}

/** Monday 00:00 London → following Monday 00:00 London for the week containing `now`. */
export function londonWeekRange(now: Date = new Date()): InstantRange & { startDate: string; endDate: string } {
  const monday = addDays(londonToday(now), 1 - londonParts(now).weekday);
  const nextMonday = addDays(monday, 7);
  return {
    startDate: toDateString(monday),
    endDate: toDateString(addDays(monday, 6)),
    start: londonMidnight(monday),
    end: londonMidnight(nextMonday),
  };
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "09:30" in London time. */
export function formatLondonTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** "Mon 6 Oct" in London time. */
export function formatLondonShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

/** Whole days from London today to a YYYY-MM-DD date (negative = past). */
export function daysFromLondonToday(dateStr: string, now: Date = new Date()): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = londonToday(now);
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((target - base) / 86_400_000);
}
