import { unassignedUrgency, type Urgency } from "../dashboard/shift-logic";
import type { VisitRow } from "../roster/types";

// The unassigned-visits tray: everything that still needs a carer (including a double-up with only
// one of its two), soonest first. Visits already over are not actionable, so they are left out,
// matching the v_unassigned_shifts view.

export interface TrayItem {
  visit: VisitRow;
  urgency: Urgency;
  /** Carers still needed. */
  needed: number;
}

export function trayItems(visits: VisitRow[], now: Date = new Date()): TrayItem[] {
  return visits
    .filter((v) => v.status !== "cancelled" && v.open_slots > 0 && Date.parse(v.end_time) > now.getTime())
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time) || a.id.localeCompare(b.id))
    .map((visit) => ({ visit, urgency: unassignedUrgency(visit.start_time, now), needed: visit.open_slots }));
}
