import { overlaps } from "../dashboard/shift-logic";
import { fitsWorkingHours, parseWorkingHours, weekKey } from "../roster/eligibility";
import { SAME_PERSON_MESSAGE, isSamePerson } from "../roster/same-person";
import type { VisitRow } from "../roster/types";
import { blockedSpans } from "./group";
import type { RosterCarer } from "./types";

// Conflict flagging for the editable calendar. Pure, so it is cheap to test and to run on every
// drag frame. Conflicts are SHOWN, never blocking, except `blocking: true` ones which the server
// also rejects (approved leave): those are true impossibilities.

export type ConflictCode =
  | "SAME_PERSON"
  | "DOUBLE_BOOKED"
  | "OUTSIDE_HOURS"
  | "UNAVAILABLE"
  | "ON_LEAVE"
  | "LEAVE_PENDING"
  | "OVER_WEEKLY_HOURS"
  | "UNDERSTAFFED";

export interface Conflict {
  code: ConflictCode;
  message: string;
  carer_id?: string;
  /** Cannot be overridden (approved leave). */
  blocking: boolean;
}

type Slim = Pick<VisitRow, "id" | "start_time" | "end_time" | "status" | "required_carers"> & { carers: { carer_id: string }[]; client_id?: string; client_name?: string };

const ms = (iso: string) => Date.parse(iso);
const live = (v: Pick<VisitRow, "status">) => v.status !== "cancelled";
const hours = (a: string, b: string) => (ms(b) - ms(a)) / 3_600_000;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Conflicts for a visit if `carerId` were on it, given the carer's other visits (ignores itself). */
export function carerConflicts(visit: Slim, carer: RosterCarer | undefined, others: Slim[]): Conflict[] {
  if (!carer || !live(visit)) return [];
  const out: Conflict[] = [];
  const who = carer.full_name;
  const id = carer.carer_id;

  if (isSamePerson({ id: visit.client_id, name: visit.client_name }, { id, name: who })) {
    out.push({ code: "SAME_PERSON", carer_id: id, blocking: true, message: `${who}: ${SAME_PERSON_MESSAGE}` });
  }

  const clashes = others.filter((o) => o.id !== visit.id && live(o) && overlaps(visit, o));
  if (clashes.length > 0) out.push({ code: "DOUBLE_BOOKED", carer_id: id, blocking: false, message: `${who} is double booked (${clashes.length} overlapping visit${clashes.length > 1 ? "s" : ""})` });

  const s = ms(visit.start_time);
  const e = ms(visit.end_time);
  for (const span of blockedSpans(carer)) {
    if (!(s < span.end && span.start < e)) continue;
    const partDay = span.label.startsWith("Unavailable");
    if (partDay) out.push({ code: "UNAVAILABLE", carer_id: id, blocking: false, message: `${who}: ${span.label}` });
    else if (span.tentative) out.push({ code: "LEAVE_PENDING", carer_id: id, blocking: false, message: `${who} has ${span.label}` });
    else out.push({ code: "ON_LEAVE", carer_id: id, blocking: true, message: `${who} is on ${span.label}` });
  }

  const wh = parseWorkingHours(carer.working_hours);
  if (wh && !fitsWorkingHours(wh, new Date(visit.start_time), new Date(visit.end_time))) {
    out.push({ code: "OUTSIDE_HOURS", carer_id: id, blocking: false, message: `${who}: outside usual working hours` });
  }

  if (carer.max_weekly_hours != null) {
    const wk = weekKey(visit.start_time);
    const total = others
      .filter((o) => o.id !== visit.id && live(o) && weekKey(o.start_time) === wk)
      .reduce((sum, o) => sum + hours(o.start_time, o.end_time), hours(visit.start_time, visit.end_time));
    if (total > carer.max_weekly_hours) {
      out.push({ code: "OVER_WEEKLY_HOURS", carer_id: id, blocking: false, message: `${who} would reach ${r1(total)}h this week (max ${carer.max_weekly_hours}h)` });
    }
  }
  return out;
}

/** Conflicts for every visit, keyed by visit id. Visits with none are absent from the map. */
export function detectConflicts(visits: VisitRow[], carers: RosterCarer[]): Map<string, Conflict[]> {
  const byCarer = new Map<string, VisitRow[]>();
  for (const v of visits) for (const c of v.carers ?? []) byCarer.set(c.carer_id, [...(byCarer.get(c.carer_id) ?? []), v]);
  const carerById = new Map(carers.map((c) => [c.carer_id, c]));
  const out = new Map<string, Conflict[]>();
  const add = (id: string, c: Conflict[]) => c.length && out.set(id, [...(out.get(id) ?? []), ...c]);

  for (const [carerId, list] of byCarer) {
    const carer = carerById.get(carerId);
    if (!carer) continue;
    for (const v of list) add(v.id, carerConflicts(v, carer, list));
  }
  for (const v of visits) {
    if (live(v) && v.carers.length < v.required_carers && v.carers.length > 0) {
      add(v.id, [{ code: "UNDERSTAFFED", blocking: false, message: `Needs ${v.required_carers} carers, has ${v.carers.length}` }]);
    }
  }
  return out;
}

export const hasBlocking = (c: Conflict[] | undefined) => !!c?.some((x) => x.blocking);
