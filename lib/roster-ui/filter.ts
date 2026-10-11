import type { VisitRow, VisitStatus } from "../roster/types";
import { visitType } from "./status";
import type { RosterCarer, VisitType } from "./types";

// In-memory filtering and search. The whole range is loaded once, so changing a filter is instant
// and needs no request.

export interface Filters {
  carers: string[];
  clients: string[];
  /** Team / area = location id. A visit's team is its client's location. */
  teams: string[];
  types: VisitType[];
  statuses: VisitStatus[];
  /** A visit matches when it requires at least one of these skills. */
  skills: string[];
  q: string;
}

export const EMPTY_FILTERS: Filters = { carers: [], clients: [], teams: [], types: [], statuses: [], skills: [], q: "" };

export function activeFilterCount(f: Filters): number {
  return (
    [f.carers, f.clients, f.teams, f.types, f.statuses, f.skills].filter((a) => a.length > 0).length + (f.q.trim() ? 1 : 0)
  );
}

export interface FilterContext {
  /** client id -> location id */
  clientTeam: Map<string, string | null>;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Does one visit pass every active filter and the search text? */
export function matchesVisit(v: VisitRow, f: Filters, ctx: FilterContext): boolean {
  if (f.statuses.length && !f.statuses.includes(v.status)) return false;
  if (f.clients.length && !f.clients.includes(v.client_id)) return false;
  if (f.carers.length && !v.carers.some((c) => f.carers.includes(c.carer_id))) return false;
  if (f.teams.length) {
    const team = ctx.clientTeam.get(v.client_id) ?? v.location_id;
    if (!team || !f.teams.includes(team)) return false;
  }
  if (f.types.length && !f.types.includes(visitType(v.start_time))) return false;
  if (f.skills.length && !v.required_skills.some((s) => f.skills.includes(s))) return false;
  const q = norm(f.q.trim());
  if (q) {
    const hay = norm([v.client_name, v.notes ?? "", ...v.carers.map((c) => c.full_name)].join(" "));
    if (!q.split(/\s+/).every((term) => hay.includes(term))) return false;
  }
  return true;
}

export function filterVisits(visits: VisitRow[], f: Filters, ctx: FilterContext): VisitRow[] {
  return activeFilterCount(f) === 0 ? visits : visits.filter((v) => matchesVisit(v, f, ctx));
}

/**
 * Which carers get a row. With no filters: everyone. With a carer filter: those carers. With any
 * other filter or search: only carers who still have a visit on screen, so the grid shrinks to what
 * you asked for instead of showing 100 empty rows.
 */
export function visibleCarers(carers: RosterCarer[], visible: VisitRow[], f: Filters): RosterCarer[] {
  if (f.carers.length) return carers.filter((c) => f.carers.includes(c.carer_id));
  const narrowed = f.clients.length || f.teams.length || f.types.length || f.statuses.length || f.skills.length || f.q.trim();
  if (!narrowed) return carers;
  const onScreen = new Set(visible.flatMap((v) => v.carers.map((c) => c.carer_id)));
  return carers.filter((c) => onScreen.has(c.carer_id));
}
