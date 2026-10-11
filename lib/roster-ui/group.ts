import { addDays, londonDateOf, londonMidnight, parseCalendarDate } from "../dates/london";
import type { VisitRow } from "../roster/types";
import type { RosterCarer } from "./types";

// Indexing helpers: turn the flat visit list into the per-row / per-day maps the views draw from.

/** Row id for visits nobody is assigned to yet. */
export const OPEN_ROW = "__open";

const byStart = (a: VisitRow, b: VisitRow) => Date.parse(a.start_time) - Date.parse(b.start_time) || a.id.localeCompare(b.id);

/** London date of the start -> visits, each day sorted by start time. */
export function groupByDay(visits: VisitRow[]): Map<string, VisitRow[]> {
  const m = new Map<string, VisitRow[]>();
  for (const v of visits) {
    const day = londonDateOf(new Date(v.start_time));
    const list = m.get(day);
    if (list) list.push(v);
    else m.set(day, [v]);
  }
  for (const list of m.values()) list.sort(byStart);
  return m;
}

/** Carer id -> visits. Visits with no carer (and not cancelled) go under OPEN_ROW. */
export function groupByCarer(visits: VisitRow[]): Map<string, VisitRow[]> {
  const m = new Map<string, VisitRow[]>();
  const add = (k: string, v: VisitRow) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  for (const v of visits) {
    if (v.carers.length === 0) {
      if (v.status !== "cancelled") add(OPEN_ROW, v);
    } else for (const c of v.carers) add(c.carer_id, v);
  }
  return m;
}

export function groupByClient(visits: VisitRow[]): Map<string, VisitRow[]> {
  const m = new Map<string, VisitRow[]>();
  for (const v of visits) {
    const list = m.get(v.client_id);
    if (list) list.push(v);
    else m.set(v.client_id, [v]);
  }
  return m;
}

/** Visits that overlap [start, end). */
export function overlapping(visits: VisitRow[], start: number, end: number): VisitRow[] {
  return visits.filter((v) => Date.parse(v.start_time) < end && Date.parse(v.end_time) > start);
}

export interface BlockedSpan {
  start: number; // ms
  end: number;
  label: string;
  /** Pending leave: shown lighter, because it is not approved yet. */
  tentative?: boolean;
}

/**
 * The areas a carer cannot work: approved leave and sickness (whole London days), pending leave
 * (tentative), and part-day unavailability blocks. Rejected leave is not returned by the API.
 */
export function blockedSpans(carer: Pick<RosterCarer, "absences" | "unavailability">): BlockedSpan[] {
  const spans: BlockedSpan[] = [];
  for (const a of carer.absences) {
    if (a.status !== "approved" && a.status !== "pending") continue;
    const label = `${a.absence_type.replace(/_/g, " ")}${a.status === "pending" ? " (pending approval)" : ""}`;
    spans.push({
      start: londonMidnight(parseCalendarDate(a.start_date)).getTime(),
      end: londonMidnight(addDays(parseCalendarDate(a.end_date), 1)).getTime(),
      label,
      tentative: a.status === "pending",
    });
  }
  for (const u of carer.unavailability) {
    spans.push({ start: Date.parse(u.starts_at), end: Date.parse(u.ends_at), label: u.reason ? `Unavailable: ${u.reason}` : "Unavailable" });
  }
  return spans;
}
