import { addDays, londonDateOf, londonParts, parseCalendarDate, toDateString } from "../dates/london";
import {
  durationBetween,
  hhmm,
  occurrenceDates,
  visitWindow,
  type RecurrenceRule,
} from "./recurrence";
import { RosterError } from "./errors";
import { canSetStatus, isStarted } from "./status";
import {
  emptyPlan,
  MAX_OCCURRENCES_PER_REQUEST,
  SERIES_HORIZON_DAYS,
  type PlanVisit,
  type RosterPlan,
  type RosterState,
  type Scope,
  type SeriesFrequency,
  type SeriesRow,
  type ShiftPatch,
  type VisitStatus,
} from "./types";

// Pure planning for create / edit / delete of visits and recurring series. Nothing here touches
// the database: each function returns a RosterPlan (what to insert / update / delete) which the
// service applies atomically through roster_apply_plan.
//
// Model: a series is a TEMPLATE that is materialised into real visits, so any one visit can still
// be edited, assigned or cancelled alone. Scopes:
//   this       just this visit. Changing its time or date marks it a series exception.
//   following  this visit and every later one in the series
//   all        every visit in the series
// following / all update the template and then patch the affected visits that have not started.
// Time and pattern changes leave exceptions alone (the coordinator moved them on purpose); notes,
// skills, location and roster state apply to exceptions too. A series is never split in two, so
// "following" also changes the template that earlier (untouched) visits were generated from.

export class PlanError extends RosterError {
  constructor(message: string, status: number = 400) {
    super(message, status);
    this.name = "PlanError";
  }
}

export interface PlanResult {
  plan: RosterPlan;
  /** Visits the operation applies to. */
  affected: string[];
  /** Visits in scope that were left alone, with the reason. */
  skipped: { id: string; reason: string }[];
}

const isEditable = (v: PlanVisit) => !isStarted(v) && v.status !== "cancelled";

/** The visits an operation with `scope` applies to. A visit that is not in a series is always just itself. */
export function selectAffected(visits: PlanVisit[], target: PlanVisit, scope: Scope): PlanVisit[] {
  if (scope === "this" || !target.series_id) return [target];
  const inSeries = visits.filter((v) => v.series_id === target.series_id);
  if (!inSeries.some((v) => v.id === target.id)) inSeries.push(target);
  if (scope === "all") return inSeries;
  const from = target.occurrence_date;
  if (!from) return [target];
  return inSeries.filter((v) => v.occurrence_date !== null && v.occurrence_date >= from);
}

const londonHHmm = (iso: string): string => {
  const p = londonParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
const ruleOf = (s: SeriesRow): RecurrenceRule => ({
  frequency: s.frequency,
  repeat_every: s.repeat_every,
  by_weekday: s.by_weekday,
  start_date: s.start_date,
  until_date: s.until_date,
});
const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const maxDate = (dates: string[]) => dates.reduce((m, d) => (d > m ? d : m), "");
const defaultUuid = () => crypto.randomUUID();

// ── Create ───────────────────────────────────────────────────────────────────

export interface CreateInput {
  client_id: string;
  location_id?: string | null;
  /** London date of the (first) visit, YYYY-MM-DD. */
  date: string;
  /** London wall-clock HH:mm. An end at or before the start means the visit runs past midnight. */
  start_time: string;
  end_time: string;
  required_carers: number;
  required_skills: string[];
  notes?: string | null;
  roster_state: RosterState;
  recurrence?: {
    frequency: SeriesFrequency;
    repeat_every: number;
    by_weekday: number[];
    until_date?: string | null;
  } | null;
}

export interface CreateContext {
  orgId: string;
  adminId?: string | null;
  /** London today, YYYY-MM-DD. */
  today: string;
  genUuid?: () => string;
}

export function planCreate(input: CreateInput, ctx: CreateContext): { plan: RosterPlan; visitIds: string[]; seriesId: string | null } {
  const genUuid = ctx.genUuid ?? defaultUuid;
  const duration = durationBetween(input.start_time, input.end_time);
  if (duration <= 0) throw new PlanError("End time must differ from start time");

  const plan = emptyPlan();
  const base = {
    client_id: input.client_id,
    location_id: input.location_id ?? null,
    notes: input.notes ?? null,
    required_carers: input.required_carers,
    required_skills: input.required_skills,
    roster_state: input.roster_state,
    created_by: ctx.adminId ?? null,
  };

  if (!input.recurrence) {
    const w = visitWindow(input.date, input.start_time, duration);
    const id = genUuid();
    plan.shift_inserts.push({
      id, ...base, start_time: w.start.toISOString(), end_time: w.end.toISOString(), series_id: null, occurrence_date: null,
    });
    return { plan, visitIds: [id], seriesId: null };
  }

  const rec = input.recurrence;
  // Open-ended (or very long) series are materialised a rolling 12 weeks ahead; extending them
  // later is a roll-forward job, not part of this phase.
  const horizon = toDateString(addDays(parseCalendarDate(input.date > ctx.today ? input.date : ctx.today), SERIES_HORIZON_DAYS));
  const generatedUntil = rec.until_date && rec.until_date < horizon ? rec.until_date : horizon;
  const series: SeriesRow = {
    id: genUuid(),
    org_id: ctx.orgId,
    client_id: input.client_id,
    location_id: input.location_id ?? null,
    frequency: rec.frequency,
    repeat_every: rec.repeat_every,
    by_weekday: rec.frequency === "custom" ? [...rec.by_weekday].sort() : [],
    start_date: input.date,
    until_date: rec.until_date ?? null,
    start_time: hhmm(input.start_time),
    duration_minutes: duration,
    required_carers: input.required_carers,
    required_skills: input.required_skills,
    default_carer_ids: [],
    notes: input.notes ?? null,
    excluded_dates: [],
    generated_until: generatedUntil,
    created_by: ctx.adminId ?? null,
  };

  const dates = occurrenceDates(ruleOf(series), series.start_date, generatedUntil);
  if (dates.length === 0) throw new PlanError("The recurrence produces no visits in the requested range");
  if (dates.length > MAX_OCCURRENCES_PER_REQUEST) {
    throw new PlanError(`That would create ${dates.length} visits; the limit is ${MAX_OCCURRENCES_PER_REQUEST} per request`);
  }

  plan.series_upserts.push(series);
  const visitIds: string[] = [];
  for (const date of dates) {
    const w = visitWindow(date, series.start_time, duration);
    const id = genUuid();
    visitIds.push(id);
    plan.shift_inserts.push({
      id, ...base, start_time: w.start.toISOString(), end_time: w.end.toISOString(), series_id: series.id, occurrence_date: date,
    });
  }
  return { plan, visitIds, seriesId: series.id };
}

// ── Edit ─────────────────────────────────────────────────────────────────────

export interface EditPatch {
  /** London date to move a single visit to (scope 'this' only). */
  date?: string;
  start_time?: string;
  end_time?: string;
  location_id?: string | null;
  required_carers?: number;
  required_skills?: string[];
  notes?: string | null;
  roster_state?: RosterState;
  /** Scope 'this' only. */
  status?: VisitStatus;
  /** Scope 'following' / 'all' only. */
  recurrence?: {
    frequency?: SeriesFrequency;
    repeat_every?: number;
    by_weekday?: number[];
    until_date?: string | null;
  };
}

export interface EditContext {
  series: SeriesRow | null;
  /** All visits of the series (ignored when the target is not in a series). */
  visits: PlanVisit[];
  genUuid?: () => string;
}

export function planEdit(target: PlanVisit, scope: Scope, patch: EditPatch, ctx: EditContext): PlanResult {
  const series = target.series_id ? ctx.series : null;
  if (patch.date && scope !== "this") throw new PlanError("A date change applies to one visit: use scope 'this'");
  if (patch.status && scope !== "this") throw new PlanError("A status change applies to one visit: use scope 'this'");
  if (patch.recurrence && (scope === "this" || !series)) {
    throw new PlanError("The recurrence pattern can only be changed on a recurring visit with scope 'following' or 'all'");
  }
  return scope === "this" || !series ? editOne(target, series, patch) : editSeries(target, series, scope, patch, ctx);
}

function editOne(target: PlanVisit, series: SeriesRow | null, patch: EditPatch): PlanResult {
  const plan = emptyPlan();
  const upd: ShiftPatch = { id: target.id };
  const touchesTime = patch.date !== undefined || patch.start_time !== undefined || patch.end_time !== undefined;

  if ((touchesTime || patch.required_carers !== undefined) && isStarted(target)) {
    throw new PlanError("This visit has already started and can no longer be rescheduled", 409);
  }

  if (touchesTime) {
    const day = patch.date ?? londonDateOf(new Date(target.start_time));
    const startHHmm = patch.start_time ?? londonHHmm(target.start_time);
    const duration = patch.end_time
      ? durationBetween(startHHmm, patch.end_time)
      : minutesBetween(target.start_time, target.end_time);
    if (duration <= 0) throw new PlanError("End time must differ from start time");
    const w = visitWindow(day, startHHmm, duration);
    upd.start_time = w.start.toISOString();
    upd.end_time = w.end.toISOString();
    if (series) upd.is_series_exception = true; // moved on purpose: series-wide time changes now skip it
  }

  if (patch.status !== undefined) {
    const t = canSetStatus(target.status, patch.status);
    if (!t.ok) throw new PlanError(t.reason, 409);
    upd.status = patch.status;
  }
  copyCommon(upd, patch);
  if (patch.required_carers !== undefined) {
    for (const carer of target.carer_ids.slice(patch.required_carers)) {
      plan.assignment_removes.push({ shift_id: target.id, carer_id: carer });
    }
  }

  plan.shift_updates.push(upd);
  return { plan, affected: [target.id], skipped: [] };
}

/** Non-time fields that apply to a visit whatever the scope. */
function copyCommon(upd: ShiftPatch, patch: EditPatch): void {
  if (patch.location_id !== undefined) upd.location_id = patch.location_id;
  if (patch.notes !== undefined) upd.notes = patch.notes;
  if (patch.roster_state !== undefined) upd.roster_state = patch.roster_state;
  if (patch.required_carers !== undefined) upd.required_carers = patch.required_carers;
  if (patch.required_skills !== undefined) upd.required_skills = patch.required_skills;
}

function editSeries(target: PlanVisit, series: SeriesRow, scope: Scope, patch: EditPatch, ctx: EditContext): PlanResult {
  const genUuid = ctx.genUuid ?? defaultUuid;
  const plan = emptyPlan();
  const skipped: { id: string; reason: string }[] = [];
  const affected = selectAffected(ctx.visits, target, scope);
  if (patch.required_carers !== undefined && affected.some((v) => isStarted(v) && v.id === target.id)) {
    throw new PlanError("This visit has already started and can no longer be changed", 409);
  }

  // 1. The new template.
  const tmpl: SeriesRow = { ...series, start_time: hhmm(series.start_time) };
  if (patch.start_time !== undefined || patch.end_time !== undefined) {
    tmpl.start_time = patch.start_time ?? tmpl.start_time;
    tmpl.duration_minutes = patch.end_time ? durationBetween(tmpl.start_time, patch.end_time) : series.duration_minutes;
    if (tmpl.duration_minutes <= 0) throw new PlanError("End time must differ from start time");
  }
  if (patch.location_id !== undefined) tmpl.location_id = patch.location_id;
  if (patch.notes !== undefined) tmpl.notes = patch.notes;
  if (patch.required_carers !== undefined) tmpl.required_carers = patch.required_carers;
  if (patch.required_skills !== undefined) tmpl.required_skills = patch.required_skills;

  const rec = patch.recurrence;
  if (rec) {
    if (rec.frequency !== undefined) tmpl.frequency = rec.frequency;
    if (rec.repeat_every !== undefined) tmpl.repeat_every = rec.repeat_every;
    if (rec.by_weekday !== undefined) tmpl.by_weekday = [...rec.by_weekday].sort();
    if (rec.until_date !== undefined) tmpl.until_date = rec.until_date;
    if (tmpl.frequency !== "custom") tmpl.by_weekday = [];
    if (tmpl.frequency === "custom" && tmpl.by_weekday.length === 0) {
      throw new PlanError("A custom recurrence needs at least one weekday");
    }
    if (tmpl.until_date && tmpl.until_date < tmpl.start_date) throw new PlanError("The end date is before the series starts");
  }

  const timeChanged = tmpl.start_time !== hhmm(series.start_time) || tmpl.duration_minutes !== series.duration_minutes;
  const patternChanged =
    !!rec &&
    (tmpl.frequency !== series.frequency ||
      tmpl.repeat_every !== series.repeat_every ||
      !sameSet(tmpl.by_weekday, series.by_weekday) ||
      tmpl.until_date !== series.until_date);

  // 2. Which dates the pattern now produces (only needed when the pattern changed).
  const existingByDate = new Map<string, PlanVisit>();
  for (const v of ctx.visits) if (v.series_id === series.id && v.occurrence_date) existingByDate.set(v.occurrence_date, v);
  const allDates = [...existingByDate.keys()];
  const fromDate = scope === "following" && target.occurrence_date ? target.occurrence_date : tmpl.start_date;
  const generatedUntil = series.generated_until ?? (allDates.length ? maxDate(allDates) : tmpl.start_date);
  const limit = tmpl.until_date && tmpl.until_date < generatedUntil ? tmpl.until_date : generatedUntil;
  const newDates = patternChanged ? new Set(occurrenceDates(ruleOf(tmpl), fromDate, limit, tmpl.excluded_dates)) : null;
  if (newDates && newDates.size > MAX_OCCURRENCES_PER_REQUEST) {
    throw new PlanError(`That would produce ${newDates.size} visits; the limit is ${MAX_OCCURRENCES_PER_REQUEST} per request`);
  }
  if (patternChanged) tmpl.generated_until = limit < generatedUntil ? limit : series.generated_until;

  // 3. Patch / remove the affected visits.
  for (const v of affected) {
    if (!isEditable(v)) {
      skipped.push({ id: v.id, reason: v.status === "cancelled" ? "cancelled" : "already started" });
      continue;
    }
    const onPattern = !newDates || v.is_series_exception || (v.occurrence_date !== null && newDates.has(v.occurrence_date));
    if (!onPattern) {
      plan.shift_deletes.push(v.id); // no longer on the pattern
      continue;
    }

    const upd: ShiftPatch = { id: v.id };
    copyCommon(upd, patch);
    if (timeChanged) {
      if (v.is_series_exception || !v.occurrence_date) {
        skipped.push({ id: v.id, reason: "moved individually; time left unchanged" });
      } else {
        const w = visitWindow(v.occurrence_date, tmpl.start_time, tmpl.duration_minutes);
        upd.start_time = w.start.toISOString();
        upd.end_time = w.end.toISOString();
      }
    }
    if (patch.required_carers !== undefined) {
      for (const carer of v.carer_ids.slice(patch.required_carers)) {
        plan.assignment_removes.push({ shift_id: v.id, carer_id: carer });
      }
    }
    if (Object.keys(upd).length > 1) plan.shift_updates.push(upd);
  }

  // 4. New dates the pattern now produces (any date with a visit already, even a cancelled or
  //    exception one, is left as it is).
  if (newDates) {
    for (const date of [...newDates].sort()) {
      if (existingByDate.has(date)) continue;
      const w = visitWindow(date, tmpl.start_time, tmpl.duration_minutes);
      plan.shift_inserts.push({
        id: genUuid(),
        client_id: tmpl.client_id,
        location_id: tmpl.location_id,
        start_time: w.start.toISOString(),
        end_time: w.end.toISOString(),
        notes: tmpl.notes,
        required_carers: tmpl.required_carers,
        required_skills: tmpl.required_skills,
        roster_state: patch.roster_state ?? target.roster_state,
        series_id: series.id,
        occurrence_date: date,
      });
    }
  }

  plan.series_upserts.push(tmpl);
  return { plan, affected: affected.map((v) => v.id), skipped };
}

// ── Delete ───────────────────────────────────────────────────────────────────

export function planDelete(target: PlanVisit, scope: Scope, ctx: { series: SeriesRow | null; visits: PlanVisit[] }): PlanResult {
  const plan = emptyPlan();
  const series = target.series_id ? ctx.series : null;

  if (scope === "this" || !series) {
    if (isStarted(target)) throw new PlanError("This visit has already started and cannot be deleted", 409);
    plan.shift_deletes.push(target.id);
    if (series && target.occurrence_date) {
      // Remember the date so the series never regenerates this occurrence.
      plan.series_upserts.push({ ...series, start_time: hhmm(series.start_time), excluded_dates: [...new Set([...series.excluded_dates, target.occurrence_date])].sort() });
    }
    return { plan, affected: [target.id], skipped: [] };
  }

  const affected = selectAffected(ctx.visits, target, scope);
  const skipped: { id: string; reason: string }[] = [];
  const deleted = new Set<string>();
  for (const v of affected) {
    if (isStarted(v)) skipped.push({ id: v.id, reason: "already started" });
    else {
      deleted.add(v.id);
      plan.shift_deletes.push(v.id);
    }
  }

  // Whatever survives (started visits, earlier visits) decides where the series now ends.
  const remaining = ctx.visits.filter((v) => v.series_id === series.id && !deleted.has(v.id) && v.occurrence_date);
  if (remaining.length === 0) {
    plan.series_deletes.push(series.id);
  } else {
    const last = maxDate(remaining.map((v) => v.occurrence_date as string));
    plan.series_upserts.push({
      ...series,
      start_time: hhmm(series.start_time),
      until_date: last,
      generated_until: series.generated_until && series.generated_until < last ? series.generated_until : last,
    });
  }
  return { plan, affected: [...deleted], skipped };
}
