import { formatLondonShortDate, formatLondonTime } from "@/lib/dates/london";
import type { VisitRow } from "@/lib/roster/types";
import { STATUS_STYLES } from "@/lib/roster-ui/status";

/** "Eleanor Whitmore" -> "Eleanor W." */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length < 2 ? full : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export const timeRange = (v: VisitRow) => `${formatLondonTime(v.start_time)}–${formatLondonTime(v.end_time)}`;

export function carerNames(v: VisitRow, short = true): string {
  if (v.carers.length === 0) return "Unassigned";
  const names = v.carers.map((c) => (short ? shortName(c.full_name) : c.full_name)).join(" + ");
  return v.open_slots > 0 ? `${names} (+${v.open_slots} needed)` : names;
}

/** The text on a visit block: the client in a carer's row, the carers in a client's row. */
export function blockLabel(v: VisitRow, mode: "client" | "carer"): string {
  const who = mode === "client" ? shortName(v.client_name) : carerNames(v);
  return `${formatLondonTime(v.start_time)} ${who}`;
}

/** Full sentence for screen readers. */
export function describeVisit(v: VisitRow): string {
  return [
    `${v.client_name}, ${formatLondonShortDate(v.start_time)} ${timeRange(v)}`,
    STATUS_STYLES[v.status].label,
    v.roster_state === "draft" ? "draft, not published" : "published",
    v.carers.length ? `with ${carerNames(v, false)}` : "no carer assigned",
  ].join(", ");
}
