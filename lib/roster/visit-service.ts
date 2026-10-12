import { logAudit } from "@/lib/services/audit-service";
import { addDays, londonDateOf, londonMidnight, londonWallClockToInstant, parseCalendarDate } from "../dates/london";
import { checkAssignments, type CheckRequest } from "./availability-service";
import { applyPlan, inChunks, isEmptyPlan, unwrap, type RosterDb } from "./db";
import { canAssign, type Eligibility, type Issue } from "./eligibility";
import { RosterError } from "./errors";
import type { RosterCtx } from "./http";
import { assertSkills } from "./profile-service";
import { hhmm } from "./recurrence";
import type { BatchBody, BulkBody, CreateVisitBody, ListVisitsQuery, UpdateVisitBody } from "./schemas";
import { PlanError, planCreate, planDelete, planEdit, selectAffected } from "./series-plan";
import { canSetStatus, isStarted } from "./status";
import {
  MAX_BULK_TARGETS,
  emptyPlan,
  type PlanVisit,
  type RosterPlan,
  type ShiftPatch,
  type Scope,
  type SeriesRow,
  type VisitRow,
} from "./types";

// Orchestration for visits: load -> plan (pure, see series-plan.ts / eligibility.ts) -> apply the
// whole change set in one database call -> audit. Every query is scoped to the admin's org.

const VIEW = "v_roster_visits";
const SERIES_CAP = 1000;

// ── Loading / mapping ────────────────────────────────────────────────────────

export function toPlanVisit(r: VisitRow): PlanVisit {
  return {
    id: r.id,
    client_id: r.client_id,
    location_id: r.location_id,
    start_time: r.start_time,
    end_time: r.end_time,
    status: r.status,
    roster_state: r.roster_state,
    series_id: r.series_id,
    occurrence_date: r.occurrence_date,
    is_series_exception: r.is_series_exception,
    actual_start: r.actual_start,
    required_carers: r.required_carers,
    required_skills: r.required_skills ?? [],
    notes: r.notes,
    carer_ids: [...(r.carers ?? [])].sort((a, b) => a.slot - b.slot).map((c) => c.carer_id),
  };
}

/** Postgres `time` arrives as "08:00:00"; the planner works in "HH:mm". */
export function normaliseSeries(raw: Record<string, unknown>): SeriesRow {
  const row = raw as unknown as SeriesRow;
  return {
    ...row,
    start_time: hhmm(String(row.start_time)),
    by_weekday: (row.by_weekday ?? []).map(Number),
    required_skills: row.required_skills ?? [],
    default_carer_ids: row.default_carer_ids ?? [],
    excluded_dates: row.excluded_dates ?? [],
  };
}

async function loadVisit(ctx: RosterCtx, id: string): Promise<VisitRow> {
  const row = unwrap(await ctx.db.from(VIEW).select("*").eq("org_id", ctx.orgId).eq("id", id).maybeSingle());
  if (!row) throw new RosterError("Visit not found", 404);
  return row as unknown as VisitRow;
}

async function loadSeries(ctx: RosterCtx, seriesId: string): Promise<SeriesRow | null> {
  const row = unwrap(await ctx.db.from("shift_series").select("*").eq("org_id", ctx.orgId).eq("id", seriesId).maybeSingle());
  return row ? normaliseSeries(row as Record<string, unknown>) : null;
}

/** The target's series and all its visits; just the target when it is not in a series or the scope is 'this'. */
async function loadSeriesContext(ctx: RosterCtx, target: PlanVisit, scope: Scope): Promise<{ series: SeriesRow | null; visits: PlanVisit[] }> {
  if (!target.series_id) return { series: null, visits: [target] };
  const series = await loadSeries(ctx, target.series_id);
  if (scope === "this") return { series, visits: [target] };
  const rows = unwrap(await ctx.db.from(VIEW).select("*").eq("org_id", ctx.orgId).eq("series_id", target.series_id).order("occurrence_date").limit(SERIES_CAP));
  return { series, visits: ((rows ?? []) as unknown as VisitRow[]).map(toPlanVisit) };
}

async function assertClient(ctx: RosterCtx, clientId: string) {
  const client = unwrap(await ctx.db.from("clients").select("id").eq("id", clientId).eq("org_id", ctx.orgId).maybeSingle());
  if (!client) throw new RosterError("Client not found", 404);
}

async function assertLocation(ctx: RosterCtx, locationId: string | null | undefined) {
  if (!locationId) return;
  const loc = unwrap(await ctx.db.from("locations").select("id").eq("id", locationId).eq("org_id", ctx.orgId).maybeSingle());
  if (!loc) throw new RosterError("Location not found", 404);
}

const rangeInstants = (from: string, to: string) => ({
  start: londonMidnight(parseCalendarDate(from)),
  end: londonMidnight(addDays(parseCalendarDate(to), 1)),
});

function audit(ctx: RosterCtx, action: string, entityId: string | null, details: string) {
  void logAudit({ action: `roster.${action}`, entityType: "visit", entityId, actorId: ctx.adminId, orgId: ctx.orgId, details });
}

// ── List ─────────────────────────────────────────────────────────────────────

interface VisitFilter {
  from: string;
  to: string;
  client_id?: string;
  carer_id?: string;
  location_id?: string;
  series_id?: string;
  roster_state?: string;
  skill?: string;
  status?: string[];
  unassigned?: boolean;
}

function visitQuery(db: RosterDb, orgId: string, f: VisitFilter, count: boolean) {
  const { start, end } = rangeInstants(f.from, f.to);
  let q = db.from(VIEW).select("*", count ? { count: "exact" } : undefined)
    .eq("org_id", orgId).gte("start_time", start.toISOString()).lt("start_time", end.toISOString());
  if (f.client_id) q = q.eq("client_id", f.client_id);
  if (f.location_id) q = q.eq("location_id", f.location_id);
  if (f.series_id) q = q.eq("series_id", f.series_id);
  if (f.roster_state) q = q.eq("roster_state", f.roster_state);
  if (f.status) q = q.in("status", f.status);
  if (f.skill) q = q.contains("required_skills", [f.skill]);
  // jsonb containment: the carers column is an array of objects (supabase-js would format a JS array as a Postgres array)
  if (f.carer_id) q = q.filter("carers", "cs", JSON.stringify([{ carer_id: f.carer_id }]));
  if (f.unassigned === true) q = q.eq("status", "unassigned");
  if (f.unassigned === false) q = q.neq("status", "unassigned");
  return q;
}

export async function listVisits(ctx: RosterCtx, q: ListVisitsQuery) {
  const res = await visitQuery(ctx.db, ctx.orgId, q, true).order("start_time").order("id").range(q.offset, q.offset + q.limit - 1);
  const rows = unwrap(res) as unknown as VisitRow[] | null;
  return { visits: rows ?? [], total: res.count ?? rows?.length ?? 0, limit: q.limit, offset: q.offset };
}

export async function getVisit(ctx: RosterCtx, id: string) {
  const visit = await loadVisit(ctx, id);
  const series = visit.series_id ? await loadSeries(ctx, visit.series_id) : null;
  return { visit, series };
}

// ── Eligibility helpers ──────────────────────────────────────────────────────

interface Failure {
  visit_id: string;
  carer_id: string;
  start_time: string;
  blocked: Issue[];
  overridable: Issue[];
}

function reqFor(v: { id: string; client_id: string; start_time: string; end_time: string; required_skills: string[] }, carer_id: string): CheckRequest {
  return { visit: { id: v.id, client_id: v.client_id, start_time: v.start_time, end_time: v.end_time, required_skills: v.required_skills }, carer_id };
}

function failuresOf(reqs: CheckRequest[], results: Eligibility[], force: boolean): Failure[] {
  const out: Failure[] = [];
  results.forEach((e, i) => {
    if (!canAssign(e, force)) {
      out.push({ visit_id: reqs[i].visit.id, carer_id: reqs[i].carer_id, start_time: reqs[i].visit.start_time, blocked: e.blocked, overridable: e.overridable });
    }
  });
  return out;
}

const overrideNote = (e: Eligibility) => (e.overridable.length ? `forced past: ${e.overridable.map((i) => i.code).join(", ")}` : "");

// ── Create ───────────────────────────────────────────────────────────────────

export async function createVisits(ctx: RosterCtx, body: CreateVisitBody) {
  await assertClient(ctx, body.client_id);
  await assertLocation(ctx, body.location_id);
  await assertSkills(ctx, body.required_skills);

  const { plan, visitIds, seriesId } = planCreate(
    {
      client_id: body.client_id,
      location_id: body.location_id ?? null,
      date: body.date,
      start_time: body.start_time,
      end_time: body.end_time,
      required_carers: body.required_carers,
      required_skills: body.required_skills,
      notes: body.notes ?? null,
      roster_state: body.roster_state,
      recurrence: body.recurrence
        ? { frequency: body.recurrence.frequency, repeat_every: body.recurrence.repeat_every, by_weekday: body.recurrence.by_weekday, until_date: body.recurrence.until_date ?? null }
        : null,
    },
    { orgId: ctx.orgId, adminId: ctx.adminId, today: londonDateOf(new Date()) },
  );

  const warnings: { visit_id: string; carer_id: string; issues: Issue[] }[] = [];
  let forced = "";
  if (body.carer_ids.length > 0) {
    const reqs = plan.shift_inserts.flatMap((v) => body.carer_ids.map((c) => reqFor(v, c)));
    const results = await checkAssignments(ctx, reqs, { force: body.force });
    const failed = failuresOf(reqs, results, body.force);
    if (failed.length > 0) {
      throw new RosterError("One or more carers cannot be assigned", 409, {
        issues: failed.slice(0, 20),
        total_failures: failed.length,
        hint: "Blocked issues can never be overridden; pass force=true to override the others.",
      });
    }
    results.forEach((e, i) => {
      plan.assignment_adds.push({ shift_id: reqs[i].visit.id, carer_id: reqs[i].carer_id, assigned_by: ctx.adminId });
      if (e.warnings.length || e.overridable.length) warnings.push({ visit_id: reqs[i].visit.id, carer_id: reqs[i].carer_id, issues: [...e.overridable, ...e.warnings] });
      forced += overrideNote(e) ? ` ${overrideNote(e)};` : "";
    });
  }

  await applyPlan(ctx.db, ctx.orgId, plan);
  audit(ctx, "visit.create", visitIds[0], `Created ${visitIds.length} visit(s) for client ${body.client_id}${seriesId ? ` (series ${seriesId})` : ""}${forced}`.slice(0, 500));
  return { ids: visitIds, series_id: seriesId, count: visitIds.length, warnings: warnings.slice(0, 50) };
}

// ── Edit / delete ────────────────────────────────────────────────────────────

export async function updateVisit(ctx: RosterCtx, id: string, body: UpdateVisitBody) {
  const { scope, ...patch } = body;
  const target = toPlanVisit(await loadVisit(ctx, id));
  await assertLocation(ctx, patch.location_id);
  if (patch.required_skills) await assertSkills(ctx, patch.required_skills);

  const { series, visits } = await loadSeriesContext(ctx, target, scope);
  const result = planEdit(target, scope, patch, { series, visits });
  await applyPlan(ctx.db, ctx.orgId, result.plan);

  // Moving a visit can double-book whoever is on it. Not blocked (the coordinator is rearranging),
  // but reported so it can be fixed.
  const movedIds = result.plan.shift_updates.filter((u) => u.start_time).map((u) => u.id);
  const conflicts = await conflictsFor(ctx, movedIds);

  audit(ctx, "visit.update", id, `Updated ${result.affected.length} visit(s), scope ${scope}: ${Object.keys(patch).join(", ")}`);
  return { id, scope, affected: result.affected, skipped: result.skipped, conflicts, visit: await loadVisit(ctx, id).catch(() => null) };
}

export async function deleteVisit(ctx: RosterCtx, id: string, scope: Scope) {
  const target = toPlanVisit(await loadVisit(ctx, id));
  const { series, visits } = await loadSeriesContext(ctx, target, scope);
  const result = planDelete(target, scope, { series, visits });
  await applyPlan(ctx.db, ctx.orgId, result.plan);
  audit(ctx, "visit.delete", id, `Deleted ${result.affected.length} visit(s), scope ${scope}`);
  return { deleted: result.affected, skipped: result.skipped };
}

async function conflictsFor(ctx: RosterCtx, ids: string[]) {
  if (ids.length === 0) return [];
  return inChunks(ids.slice(0, 200), 40, async (chunk) => {
    const list = chunk.join(",");
    return (unwrap(await ctx.db.from("v_carer_shift_conflicts")
      .select("carer_id, shift_a_id, shift_b_id, overlap_start, overlap_end")
      .eq("org_id", ctx.orgId).or(`shift_a_id.in.(${list}),shift_b_id.in.(${list})`)) ?? []) as Record<string, unknown>[];
  });
}

// ── Assign / unassign ────────────────────────────────────────────────────────

type Skip = { id: string; reason: string };

/** Split the affected visits into those a carer can be added to, and those to skip with a reason. */
function assignCandidates(affected: PlanVisit[], carerId: string): { candidates: PlanVisit[]; skipped: Skip[]; already: string[] } {
  const candidates: PlanVisit[] = [];
  const skipped: Skip[] = [];
  const already: string[] = [];
  for (const v of affected) {
    if (v.carer_ids.includes(carerId)) already.push(v.id);
    else if (isStarted(v)) skipped.push({ id: v.id, reason: "already started" });
    else if (v.status === "cancelled") skipped.push({ id: v.id, reason: "cancelled" });
    else if (v.carer_ids.length >= v.required_carers) skipped.push({ id: v.id, reason: "all required carers are already assigned" });
    else candidates.push(v);
  }
  return { candidates, skipped, already };
}

export async function assignCarer(ctx: RosterCtx, visitId: string, body: { carer_id: string; scope: Scope; force: boolean }) {
  const target = toPlanVisit(await loadVisit(ctx, visitId));
  const { visits } = await loadSeriesContext(ctx, target, body.scope);
  const affected = selectAffected(visits, target, body.scope);
  const { candidates, skipped, already } = assignCandidates(affected, body.carer_id);

  if (body.scope === "this" && skipped.length > 0) throw new RosterError(`Cannot assign: ${skipped[0].reason}`, 409);

  const reqs = candidates.map((v) => reqFor(v, body.carer_id));
  const results = await checkAssignments(ctx, reqs, { force: body.force });
  const failed = failuresOf(reqs, results, body.force);
  if (body.scope === "this" && failed.length > 0) {
    throw new RosterError("This carer cannot be assigned to the visit", 409, {
      issues: failed,
      hint: "Blocked issues can never be overridden; pass force=true to override the others.",
    });
  }

  const failedIds = new Set(failed.map((f) => f.visit_id));
  const plan = emptyPlan();
  const warnings: { visit_id: string; issues: Issue[] }[] = [];
  let forced = "";
  reqs.forEach((r, i) => {
    if (failedIds.has(r.visit.id)) return;
    plan.assignment_adds.push({ shift_id: r.visit.id, carer_id: r.carer_id, assigned_by: ctx.adminId });
    const e = results[i];
    if (e.warnings.length || e.overridable.length) warnings.push({ visit_id: r.visit.id, issues: [...e.overridable, ...e.warnings] });
    forced += overrideNote(e) ? ` ${overrideNote(e)};` : "";
  });

  await applyPlan(ctx.db, ctx.orgId, plan);
  const assigned = plan.assignment_adds.map((a) => a.shift_id);
  if (assigned.length > 0) audit(ctx, "visit.assign", visitId, `Assigned carer ${body.carer_id} to ${assigned.length} visit(s), scope ${body.scope}${forced}`.slice(0, 500));
  return { assigned, already_assigned: already, skipped, failed, warnings: warnings.slice(0, 50) };
}

export async function unassignCarer(ctx: RosterCtx, visitId: string, carerId: string, scope: Scope) {
  const target = toPlanVisit(await loadVisit(ctx, visitId));
  const { visits } = await loadSeriesContext(ctx, target, scope);
  const affected = selectAffected(visits, target, scope).filter((v) => v.carer_ids.includes(carerId));
  if (scope === "this" && affected.length === 0) throw new RosterError("That carer is not assigned to this visit", 404);

  const plan = emptyPlan();
  const skipped: Skip[] = [];
  for (const v of affected) {
    if (isStarted(v)) skipped.push({ id: v.id, reason: "already started" });
    else plan.assignment_removes.push({ shift_id: v.id, carer_id: carerId });
  }
  if (scope === "this" && skipped.length > 0) throw new RosterError("This visit has already started; the carer cannot be removed", 409);

  await applyPlan(ctx.db, ctx.orgId, plan);
  const unassigned = plan.assignment_removes.map((r) => r.shift_id);
  if (unassigned.length > 0) audit(ctx, "visit.unassign", visitId, `Removed carer ${carerId} from ${unassigned.length} visit(s), scope ${scope}`);
  return { unassigned, skipped };
}

// ── Bulk ─────────────────────────────────────────────────────────────────────

export interface BulkResult {
  id: string;
  ok: boolean;
  error?: string;
  warnings?: Issue[];
}

async function resolveTargets(ctx: RosterCtx, body: BulkBody): Promise<{ visits: VisitRow[]; missing: string[] }> {
  if (body.ids) {
    const rows = await inChunks(body.ids, 100, async (chunk) =>
      (unwrap(await ctx.db.from(VIEW).select("*").eq("org_id", ctx.orgId).in("id", chunk)) ?? []) as unknown as VisitRow[]);
    const found = new Set(rows.map((r) => r.id));
    return { visits: rows, missing: body.ids.filter((id) => !found.has(id)) };
  }
  const f = body.filter!;
  const rows = unwrap(await visitQuery(ctx.db, ctx.orgId, f, false).order("start_time").order("id").range(0, MAX_BULK_TARGETS)) as unknown as VisitRow[] | null;
  if ((rows?.length ?? 0) > MAX_BULK_TARGETS) {
    throw new RosterError(`The filter matches more than ${MAX_BULK_TARGETS} visits; narrow the date range or add filters`, 400);
  }
  return { visits: rows ?? [], missing: [] };
}

function mergePlan(into: RosterPlan, from: RosterPlan) {
  (Object.keys(into) as (keyof RosterPlan)[]).forEach((k) => (into[k] as unknown[]).push(...(from[k] as unknown[])));
}

/**
 * Apply one action to many visits. Each visit succeeds or fails on its own merits and the result
 * lists every one; the changes for the visits that pass are applied atomically in one database call.
 */
export async function bulkOperate(ctx: RosterCtx, body: BulkBody) {
  const { visits: rows, missing } = await resolveTargets(ctx, body);
  const targets = rows.map(toPlanVisit);
  const plan = emptyPlan();
  const results: BulkResult[] = missing.map((id) => ({ id, ok: false, error: "Visit not found" }));
  const fail = (id: string, error: string) => results.push({ id, ok: false, error });
  const pass = (id: string, warnings?: Issue[]) => results.push({ id, ok: true, ...(warnings?.length ? { warnings } : {}) });
  let forcedNote = "";

  switch (body.action) {
    case "publish":
    case "unpublish":
      for (const v of targets) {
        plan.shift_updates.push({ id: v.id, roster_state: body.action === "publish" ? "published" : "draft" });
        pass(v.id);
      }
      break;

    case "set_status":
      for (const v of targets) {
        const t = canSetStatus(v.status, body.status!);
        if (!t.ok) fail(v.id, t.reason);
        else if (body.status === "confirmed" && v.carer_ids.length < v.required_carers) fail(v.id, "Not fully staffed, so it cannot be confirmed");
        else {
          plan.shift_updates.push({ id: v.id, status: body.status });
          pass(v.id);
        }
      }
      break;

    case "update": {
      const changes = body.changes!;
      await assertLocation(ctx, changes.location_id);
      if (changes.required_skills) await assertSkills(ctx, changes.required_skills);
      for (const v of targets) {
        try {
          const r = planEdit(v, "this", changes, { series: null, visits: [v] });
          mergePlan(plan, r.plan);
          pass(v.id);
        } catch (e) {
          if (e instanceof PlanError) fail(v.id, e.message);
          else throw e;
        }
      }
      break;
    }

    case "delete": {
      const seriesDates = new Map<string, string[]>();
      for (const v of targets) {
        if (isStarted(v)) {
          fail(v.id, "Already started, so it cannot be deleted");
          continue;
        }
        plan.shift_deletes.push(v.id);
        if (v.series_id && v.occurrence_date) seriesDates.set(v.series_id, [...(seriesDates.get(v.series_id) ?? []), v.occurrence_date]);
        pass(v.id);
      }
      // Remember the deleted dates so the series never regenerates them (one upsert per series).
      for (const [seriesId, dates] of seriesDates) {
        const series = await loadSeries(ctx, seriesId);
        if (series) plan.series_upserts.push({ ...series, excluded_dates: [...new Set([...series.excluded_dates, ...dates])].sort() });
      }
      break;
    }

    case "assign": {
      const carerId = body.carer_id!;
      const { candidates, skipped, already } = assignCandidates(targets, carerId);
      already.forEach((id) => pass(id));
      skipped.forEach((s) => fail(s.id, s.reason));
      const reqs = candidates.map((v) => reqFor(v, carerId));
      const checked = await checkAssignments(ctx, reqs, { force: body.force });
      const failed = new Map(failuresOf(reqs, checked, body.force).map((f) => [f.visit_id, f]));
      reqs.forEach((r, i) => {
        const f = failed.get(r.visit.id);
        if (f) {
          fail(r.visit.id, [...f.blocked, ...f.overridable].map((x) => x.message).join("; "));
          return;
        }
        plan.assignment_adds.push({ shift_id: r.visit.id, carer_id: carerId, assigned_by: ctx.adminId });
        pass(r.visit.id, [...checked[i].overridable, ...checked[i].warnings]);
        forcedNote += overrideNote(checked[i]) ? ` ${overrideNote(checked[i])};` : "";
      });
      break;
    }

    case "unassign":
      for (const v of targets) {
        if (!v.carer_ids.includes(body.carer_id!)) fail(v.id, "That carer is not assigned to this visit");
        else if (isStarted(v)) fail(v.id, "Already started, so the carer cannot be removed");
        else {
          plan.assignment_removes.push({ shift_id: v.id, carer_id: body.carer_id! });
          pass(v.id);
        }
      }
      break;
  }

  if (!body.dry_run && !isEmptyPlan(plan)) {
    await applyPlan(ctx.db, ctx.orgId, plan);
    const ok = results.filter((r) => r.ok).length;
    audit(ctx, `bulk.${body.action}`, null, `${body.action}: ${ok} ok, ${results.length - ok} failed${forcedNote}`.slice(0, 500));
  }

  const succeeded = results.filter((r) => r.ok).length;
  return { action: body.action, dry_run: body.dry_run, requested: results.length, succeeded, failed: results.length - succeeded, results };
}


// ── Batch edit (calendar) ────────────────────────────────────────────────────

/** Does [start, end) equal the series' own time for that occurrence (London wall-clock start + duration)? */
async function matchesSeriesPattern(ctx: RosterCtx, seriesId: string, occurrenceDate: string | null, startIso: string, endIso: string): Promise<boolean> {
  if (!occurrenceDate) return false;
  const series = await loadSeries(ctx, seriesId);
  if (!series) return false;
  const [h, m] = series.start_time.split(":").map(Number);
  const expected = londonWallClockToInstant(parseCalendarDate(occurrenceDate), h, m).getTime();
  return Date.parse(startIso) === expected && Date.parse(endIso) - Date.parse(startIso) === series.duration_minutes * 60_000;
}

const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b);
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Apply a set of whole-visit changes atomically. Used for every calendar action, including undo and
 * redo (which just send the earlier or later state). Rules:
 *  - a visit that changed since the client loaded it is STALE (409), so nothing is silently clobbered;
 *  - started / completed visits cannot be edited or deleted;
 *  - blocked eligibility issues (approved leave, do-not-pair, ...) are never overridable;
 *  - overridable issues (double booking, missing skill, ...) need force + a reason, which is audited.
 * Assignments are checked against the database as it was before this batch.
 */
export async function applyBatch(ctx: RosterCtx, body: BatchBody) {
  const wanted = [...body.upserts.map((u) => u.id), ...body.deletes.map((d) => d.id)];
  const existing = new Map<string, VisitRow>(
    (await inChunks(wanted, 100, async (chunk) =>
      (unwrap(await ctx.db.from(VIEW).select("*").eq("org_id", ctx.orgId).in("id", chunk)) ?? []) as unknown as VisitRow[])).map((r) => [r.id, r]),
  );

  // Stale check: the client's version must match what is stored.
  const stale = [
    ...body.upserts.filter((u) => existing.has(u.id) && u.updated_at && !sameInstant(existing.get(u.id)!.updated_at, u.updated_at)).map((u) => u.id),
    ...body.deletes.filter((d) => existing.has(d.id) && d.updated_at && !sameInstant(existing.get(d.id)!.updated_at, d.updated_at)).map((d) => d.id),
  ];
  if (stale.length > 0) throw new RosterError("These visits were changed by someone else. The roster has been refreshed.", 409, { code: "STALE", ids: stale });

  const started = [...body.upserts, ...body.deletes].filter((x) => {
    const row = existing.get(x.id);
    return row && isStarted(row);
  });
  if (started.length > 0) throw new RosterError("A visit that has already started cannot be changed", 409, { code: "STARTED", ids: started.map((s) => s.id) });

  const missingDeletes = body.deletes.filter((d) => !existing.has(d.id));
  const plan = emptyPlan();
  const checks: CheckRequest[] = [];

  // New visits: validate their client / location / series once.
  const creates = body.upserts.filter((u) => !existing.has(u.id));
  for (const clientId of new Set(creates.map((u) => u.client_id))) await assertClient(ctx, clientId);
  for (const loc of new Set(body.upserts.map((u) => u.location_id).filter((l): l is string => !!l))) await assertLocation(ctx, loc);
  const liveSeries = new Set<string>();
  for (const sid of new Set(creates.map((u) => u.series_id).filter((s): s is string => !!s))) {
    if (await loadSeries(ctx, sid)) liveSeries.add(sid);
  }

  for (const u of body.upserts) {
    const prev = existing.get(u.id);
    const carerIds = u.carer_ids;
    const forCheck = { id: u.id, client_id: u.client_id, start_time: u.start_time, end_time: u.end_time, required_skills: u.required_skills };
    if (!prev) {
      const inSeries = !!u.series_id && liveSeries.has(u.series_id);
      plan.shift_inserts.push({
        id: u.id,
        client_id: u.client_id,
        location_id: u.location_id ?? null,
        start_time: new Date(u.start_time).toISOString(),
        end_time: new Date(u.end_time).toISOString(),
        notes: u.notes ?? null,
        required_carers: u.required_carers,
        required_skills: u.required_skills,
        roster_state: u.roster_state,
        // Re-creating a deleted occurrence (undo): stay attached to its series as an exception, so the
        // series never generates a duplicate for that date.
        series_id: inSeries ? u.series_id! : null,
        occurrence_date: inSeries ? (u.occurrence_date ?? null) : null,
        is_series_exception: inSeries,
        created_by: ctx.adminId,
      });
      carerIds.forEach((c, i) => plan.assignment_adds.push({ shift_id: u.id, carer_id: c, slot: (i + 1) as 1 | 2, assigned_by: ctx.adminId }));
      carerIds.forEach((c) => checks.push(reqFor(forCheck, c)));
      continue;
    }

    const timeChanged = !sameInstant(prev.start_time, u.start_time) || !sameInstant(prev.end_time, u.end_time);
    const patch: ShiftPatch = { id: u.id };
    if (timeChanged) {
      patch.start_time = new Date(u.start_time).toISOString();
      patch.end_time = new Date(u.end_time).toISOString();
      // Moved on purpose: series-wide edits skip it. Moving it back onto the series pattern (e.g. undo)
      // makes it a normal occurrence again.
      if (prev.series_id) patch.is_series_exception = !(await matchesSeriesPattern(ctx, prev.series_id, prev.occurrence_date, u.start_time, u.end_time));
    }
    if ((u.location_id ?? null) !== prev.location_id) patch.location_id = u.location_id ?? null;
    if ((u.notes ?? null) !== prev.notes) patch.notes = u.notes ?? null;
    if (u.required_carers !== prev.required_carers) patch.required_carers = u.required_carers;
    if (!sameSet(u.required_skills, prev.required_skills ?? [])) patch.required_skills = u.required_skills;
    if (u.roster_state !== prev.roster_state) patch.roster_state = u.roster_state;

    const before = [...(prev.carers ?? [])].sort((a, b) => a.slot - b.slot).map((c) => c.carer_id);
    const adds = carerIds.filter((c) => !before.includes(c));
    const removes = before.filter((c) => !carerIds.includes(c));
    removes.forEach((c) => plan.assignment_removes.push({ shift_id: u.id, carer_id: c }));
    adds.forEach((c) => plan.assignment_adds.push({ shift_id: u.id, carer_id: c, assigned_by: ctx.adminId }));
    // A moved visit must still be possible for the carers who stay on it (e.g. approved leave).
    const recheck = new Set([...adds, ...(timeChanged ? carerIds.filter((c) => before.includes(c)) : [])]);
    recheck.forEach((c) => checks.push(reqFor(forCheck, c)));
    if (Object.keys(patch).length > 1) plan.shift_updates.push(patch);
  }

  for (const d of body.deletes) {
    const prev = existing.get(d.id);
    if (!prev) continue;
    plan.shift_deletes.push(d.id);
    // Deleting one occurrence must not let the series regenerate it.
    if (prev.series_id && prev.occurrence_date) {
      const series = await loadSeries(ctx, prev.series_id);
      if (series) {
        const planned = plan.series_upserts.find((s) => s.id === series.id) ?? series;
        const next = { ...planned, excluded_dates: [...new Set([...planned.excluded_dates, prev.occurrence_date])].sort() };
        plan.series_upserts = [...plan.series_upserts.filter((s) => s.id !== series.id), next];
      }
    }
  }

  // Eligibility: blocked can never pass; overridable passes only with force + reason.
  const results = await checkAssignments(ctx, checks, { force: true });
  const blocked = results.flatMap((e, i) => (e.blocked.length ? [{ visit_id: checks[i].visit.id, carer_id: checks[i].carer_id, issues: e.blocked }] : []));
  if (blocked.length > 0) {
    throw new RosterError(blocked[0].issues[0].message, 409, { code: "BLOCKED", issues: blocked.slice(0, 20) });
  }
  const needOverride = results.flatMap((e, i) => (e.overridable.length ? [{ visit_id: checks[i].visit.id, carer_id: checks[i].carer_id, issues: e.overridable }] : []));
  if (needOverride.length > 0 && !body.force) {
    throw new RosterError("Some changes conflict with the roster and need an override", 409, { code: "OVERRIDE_REQUIRED", issues: needOverride.slice(0, 20) });
  }

  if (!isEmptyPlan(plan)) await applyPlan(ctx.db, ctx.orgId, plan);

  const overrideNote = needOverride.length ? ` override (${body.reason}): ${[...new Set(needOverride.flatMap((n) => n.issues.map((i) => i.code)))].join(", ")}` : "";
  audit(ctx, "visit.batch", body.upserts[0]?.id ?? body.deletes[0]?.id ?? null,
    `${body.label ?? "Edit"}: ${body.upserts.length} saved, ${plan.shift_deletes.length} deleted${overrideNote}`.slice(0, 500));

  const saved = body.upserts.map((u) => u.id);
  const visits = await inChunks(saved, 100, async (chunk) =>
    (unwrap(await ctx.db.from(VIEW).select("*").eq("org_id", ctx.orgId).in("id", chunk)) ?? []) as unknown as VisitRow[]);
  return {
    visits,
    deleted: plan.shift_deletes,
    already_gone: missingDeletes.map((d) => d.id),
    conflicts: await conflictsFor(ctx, saved),
    overridden: needOverride,
  };
}
