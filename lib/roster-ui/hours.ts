import type { VisitRow } from "../roster/types";

// Per-carer hour totals for the row headers. Cancelled visits do not count; a visit that spans the
// edge of a window (e.g. an overnight call) counts only the part inside it.

export interface HourWindow {
  start: number; // ms, inclusive
  end: number; // ms, exclusive
}

export interface CarerHours {
  day: number;
  week: number;
}

const overlapHours = (a0: number, a1: number, w: HourWindow) => Math.max(0, Math.min(a1, w.end) - Math.max(a0, w.start)) / 3_600_000;

/** Hours per carer id for one day window and one week window. */
export function carerHours(visits: VisitRow[], day: HourWindow, week: HourWindow): Map<string, CarerHours> {
  const out = new Map<string, CarerHours>();
  for (const v of visits) {
    if (v.status === "cancelled") continue;
    const s = Date.parse(v.start_time);
    const e = Date.parse(v.end_time);
    const d = overlapHours(s, e, day);
    const w = overlapHours(s, e, week);
    if (d === 0 && w === 0) continue;
    for (const c of v.carers) {
      const cur = out.get(c.carer_id) ?? { day: 0, week: 0 };
      cur.day += d;
      cur.week += w;
      out.set(c.carer_id, cur);
    }
  }
  return out;
}

/** "6.5h" / "32h". */
export function formatHours(h: number): string {
  const r = Math.round(h * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}h`;
}
