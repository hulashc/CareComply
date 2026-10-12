import type { CarerOnVisit, VisitRow } from "../roster/types";
import { addDays, londonDateOf, londonParts, londonWallClockToInstant, parseCalendarDate } from "../dates/london";
import { snapMs } from "./snap";

// Every roster edit is a RosterCommand: the affected visits BEFORE and AFTER, as whole rows.
//   do = send `after`, undo = send `before`, redo = send `after`, rollback = restore `before`.
// A visit only in `after` is a create; only in `before` is a delete. No per-action inverse logic.

export interface RosterCommand {
  label: string;
  before: VisitRow[];
  after: VisitRow[];
  /** Series scope for single-visit edits that go through PATCH (recurring edits). */
  scope?: "this" | "following" | "all";
}

export type CarerRef = { carer_id: string; full_name: string };

/** ms to add to a visit's start to land on the same London wall-clock time `days` days later (DST-safe). */
export function dayShiftMs(startIso: string, days: number): number {
  const start = new Date(startIso);
  const p = londonParts(start);
  const target = addDays(parseCalendarDate(londonDateOf(start)), days);
  return londonWallClockToInstant(target, p.hour, p.minute).getTime() - start.getTime();
}

function swap(rows: VisitRow[], remove: Set<string>, add: VisitRow[]): VisitRow[] {
  const kept = rows.filter((v) => !remove.has(v.id));
  return [...kept, ...add].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time) || a.id.localeCompare(b.id));
}

const ids = (c: RosterCommand) => new Set([...c.before, ...c.after].map((v) => v.id));
export const applyCommand = (rows: VisitRow[], c: RosterCommand) => swap(rows, ids(c), c.after);
export const revertCommand = (rows: VisitRow[], c: RosterCommand) => swap(rows, ids(c), c.before);
export const invert = (c: RosterCommand): RosterCommand => ({ ...c, before: c.after, after: c.before });
export const cmd = (label: string, before: VisitRow[], after: VisitRow[], scope?: RosterCommand["scope"]): RosterCommand => ({ label, before, after, scope });

const slotted = (carers: CarerOnVisit[]): CarerOnVisit[] => carers.map((c, i) => ({ ...c, slot: (i + 1) as 1 | 2 }));
const statusFor = (v: VisitRow, n: number): VisitRow["status"] =>
  v.status === "unassigned" || v.status === "assigned" ? (n > 0 ? "assigned" : "unassigned") : v.status;

function withCarers(v: VisitRow, carers: CarerOnVisit[]): VisitRow {
  const c = slotted(carers);
  return { ...v, carers: c, open_slots: Math.max(0, v.required_carers - c.length), status: statusFor(v, c.length) };
}

export interface NewVisitInput {
  org_id: string;
  client_id: string;
  client_name: string;
  location_id: string | null;
  start_time: string;
  end_time: string;
  required_carers: number;
  required_skills: string[];
  notes: string | null;
  roster_state: VisitRow["roster_state"];
}

export function newVisit(input: NewVisitInput, carers: CarerRef[], id: string = crypto.randomUUID()): VisitRow {
  const now = new Date().toISOString();
  const base: VisitRow = {
    ...input,
    id,
    status: "unassigned",
    published_at: null,
    series_id: null,
    occurrence_date: null,
    is_series_exception: false,
    actual_start: null,
    actual_end: null,
    created_at: now,
    updated_at: now,
    carers: [],
    open_slots: input.required_carers,
  };
  return withCarers({ ...base, required_carers: Math.max(input.required_carers, carers.length) }, carers.map((c) => ({ ...c, slot: 1 as const })));
}

/** Move in time by `deltaMs` (new start is snapped) and optionally from one carer to another. */
export function moveVisit(v: VisitRow, o: { deltaMs?: number; snap?: number; toCarer?: CarerRef; fromCarerId?: string }): VisitRow {
  const dur = Date.parse(v.end_time) - Date.parse(v.start_time);
  const raw = Date.parse(v.start_time) + (o.deltaMs ?? 0);
  const start = o.snap ? snapMs(raw, o.snap) : raw;
  const moved: VisitRow = { ...v, start_time: new Date(start).toISOString(), end_time: new Date(start + dur).toISOString() };
  return o.toCarer ? reassign(moved, o.toCarer, o.fromCarerId) : moved;
}

/** Drag one edge to an absolute instant; never shorter than `minMs`. */
export function resizeVisit(v: VisitRow, edge: "start" | "end", toMs: number, snap: number, minMs = 5 * 60_000): VisitRow {
  const t = snapMs(toMs, snap);
  const s = Date.parse(v.start_time);
  const e = Date.parse(v.end_time);
  return edge === "start"
    ? { ...v, start_time: new Date(Math.min(t, e - minMs)).toISOString() }
    : { ...v, end_time: new Date(Math.max(t, s + minMs)).toISOString() };
}

/** Put `to` on the visit, replacing `fromCarerId` if given, else a free slot, else the last carer. */
export function reassign(v: VisitRow, to: CarerRef, fromCarerId?: string): VisitRow {
  if (v.carers.some((c) => c.carer_id === to.carer_id)) return v;
  const next = [...v.carers];
  const entry: CarerOnVisit = { carer_id: to.carer_id, full_name: to.full_name, slot: 1 };
  const at = fromCarerId ? next.findIndex((c) => c.carer_id === fromCarerId) : -1;
  if (at >= 0) next[at] = entry;
  else if (next.length < v.required_carers) next.push(entry);
  else if (next.length > 0) next[next.length - 1] = entry;
  else next.push(entry);
  return withCarers(v, next);
}

export const unassign = (v: VisitRow, carerId: string): VisitRow => withCarers(v, v.carers.filter((c) => c.carer_id !== carerId));

export const setCarers = (v: VisitRow, carers: CarerRef[]): VisitRow =>
  withCarers({ ...v, required_carers: Math.max(v.required_carers, carers.length) }, carers.map((c) => ({ ...c, slot: 1 as const })));

/** A copy at a new time: fresh id, detached from any series, unstarted, draft. */
export function cloneVisit(v: VisitRow, shiftMs: number, keepCarers = true): VisitRow {
  const now = new Date().toISOString();
  return withCarers(
    {
      ...v,
      id: crypto.randomUUID(),
      start_time: new Date(Date.parse(v.start_time) + shiftMs).toISOString(),
      end_time: new Date(Date.parse(v.end_time) + shiftMs).toISOString(),
      series_id: null,
      occurrence_date: null,
      is_series_exception: false,
      status: "unassigned",
      actual_start: null,
      actual_end: null,
      published_at: null,
      roster_state: "draft",
      created_at: now,
      updated_at: now,
    },
    keepCarers ? v.carers : [],
  );
}

/** Duplicate to other days (offsets in days). */
export function duplicateTo(visits: VisitRow[], dayOffsets: number[]): VisitRow[] {
  return dayOffsets.flatMap((d) => visits.map((v) => cloneVisit(v, dayShiftMs(v.start_time, d))));
}

/** Copy last week's one-off visits forward 7 days. Series visits already recur, so they are skipped. */
export function copyPreviousWeek(prevWeek: VisitRow[]): VisitRow[] {
  return prevWeek.filter((v) => !v.series_id && v.status !== "cancelled").map((v) => cloneVisit(v, dayShiftMs(v.start_time, 7)));
}

/** Paste so the earliest copied visit starts at `atMs`, keeping relative offsets; optionally onto one carer. */
export function pasteAt(clip: VisitRow[], atMs: number, snap: number, carer?: CarerRef): VisitRow[] {
  if (clip.length === 0) return [];
  const first = Math.min(...clip.map((v) => Date.parse(v.start_time)));
  const shift = snapMs(atMs, snap) - first;
  return clip.map((v) => {
    const c = cloneVisit(v, shift);
    return carer ? withCarers(c, [{ ...carer, slot: 1 }]) : c;
  });
}
