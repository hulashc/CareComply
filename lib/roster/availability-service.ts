import {
  addDays,
  londonDateOf,
  londonMidnight,
  londonWallClockToInstant,
  parseCalendarDate,
} from "../dates/london";
import { fetchAll, inChunks, unwrap } from "./db";
import {
  canAssign,
  checkEligibility,
  weekKey,
  type Eligibility,
  type EligibilityAbsence,
  type EligibilityCarer,
  type EligibilityClient,
  type EligibilityVisit,
} from "./eligibility";
import { RosterError } from "./errors";
import type { RosterCtx } from "./http";
import type { z } from "zod";
import type { unavailabilitySchema, workingHoursSchema } from "./schemas";

// Everything about WHEN a carer can work: weekly hours, leave (reused from `absences`) and
// part-day blocks, plus the batch loader that feeds the eligibility rules.

const IN_CHUNK = 100;

export interface CheckRequest {
  visit: EligibilityVisit & { client_id: string };
  carer_id: string;
}

/**
 * Check many (visit, carer) pairs with a fixed number of queries. Pairs are evaluated in order and
 * a pair that would be accepted (given `force`) counts as one of the carer's visits for the pairs
 * after it, so a batch cannot double-book a carer against itself.
 */
export async function checkAssignments(ctx: RosterCtx, reqs: CheckRequest[], opts: { force: boolean }): Promise<Eligibility[]> {
  if (reqs.length === 0) return [];
  const { db, orgId } = ctx;
  const carerIds = [...new Set(reqs.map((r) => r.carer_id))];
  const clientIds = [...new Set(reqs.map((r) => r.visit.client_id))];
  const minStart = new Date(Math.min(...reqs.map((r) => new Date(r.visit.start_time).getTime())));
  const maxEnd = new Date(Math.max(...reqs.map((r) => new Date(r.visit.end_time).getTime())));
  // Weekly-hours checks need the carer's whole Monday-Sunday weeks, not just the visit days.
  const weekStart = londonMidnight(parseCalendarDate(weekKey(minStart.toISOString())));
  const weekEnd = londonMidnight(addDays(parseCalendarDate(weekKey(maxEnd.toISOString())), 7));
  const minDay = londonDateOf(minStart);
  const maxDay = londonDateOf(maxEnd);

  const [carers, clients, prefs, absences, blocks, assigned] = await Promise.all([
    inChunks(carerIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("carers").select("id, full_name, status, is_available, gender, skills, pet_allergies, is_smoker, max_weekly_hours, availability").eq("org_id", orgId).in("id", ids)) ?? []),
    inChunks(clientIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("clients").select("id, full_name, preferred_carer_gender, carer_gender_required, prefers_non_smoking_carer, pets").eq("org_id", orgId).in("id", ids)) ?? []),
    inChunks(clientIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("client_carer_preferences").select("client_id, carer_id, kind").eq("org_id", orgId).in("client_id", ids)) ?? []),
    inChunks(carerIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("absences").select("carer_id, absence_type, start_date, end_date, status").eq("org_id", orgId).in("carer_id", ids).in("status", ["approved", "pending"]).lte("start_date", maxDay).gte("end_date", minDay)) ?? []),
    inChunks(carerIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("carer_unavailability").select("carer_id, starts_at, ends_at").eq("org_id", orgId).in("carer_id", ids).lt("starts_at", maxEnd.toISOString()).gt("ends_at", minStart.toISOString())) ?? []),
    inChunks(carerIds, IN_CHUNK, (ids) =>
      fetchAll<AssignedRow>((from, to) =>
        db.from("shift_assignments")
          .select("carer_id, shifts!inner(id, start_time, end_time, status)")
          .eq("org_id", orgId).in("carer_id", ids)
          .gte("shifts.start_time", weekStart.toISOString()).lt("shifts.start_time", weekEnd.toISOString())
          .order("shift_id").range(from, to))),
  ]);

  const carerById = new Map<string, EligibilityCarer>((carers as EligibilityCarer[]).map((c) => [c.id, c]));
  const clientById = new Map<string, EligibilityClient & { id: string }>((clients as (EligibilityClient & { id: string })[]).map((c) => [c.id, c]));
  const prefKey = (clientId: string, carerId: string) => `${clientId}:${carerId}`;
  const prefByPair = new Map((prefs as { client_id: string; carer_id: string; kind: "preferred" | "excluded" }[]).map((p) => [prefKey(p.client_id, p.carer_id), p.kind]));
  const group = <T extends { carer_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.carer_id, [...(m.get(r.carer_id) ?? []), r]);
    return m;
  };
  const absencesBy = group(absences as (EligibilityAbsence & { carer_id: string })[]);
  const blocksBy = group(blocks as { carer_id: string; starts_at: string; ends_at: string }[]);
  const othersBy = new Map<string, { id: string; start_time: string; end_time: string; status: string }[]>();
  for (const row of assigned) {
    const s = Array.isArray(row.shifts) ? row.shifts[0] : row.shifts;
    if (s) othersBy.set(row.carer_id, [...(othersBy.get(row.carer_id) ?? []), s]);
  }

  const accepted = new Map<string, { id: string; start_time: string; end_time: string; status: string }[]>();
  return reqs.map((req) => {
    const carer = carerById.get(req.carer_id);
    if (!carer) throw new RosterError("Carer not found", 404);
    const client = clientById.get(req.visit.client_id);
    if (!client) throw new RosterError("Client not found", 404);

    const result = checkEligibility({
      carer,
      client,
      visit: req.visit,
      preference: prefByPair.get(prefKey(req.visit.client_id, req.carer_id)) ?? null,
      absences: absencesBy.get(req.carer_id) ?? [],
      unavailability: blocksBy.get(req.carer_id) ?? [],
      otherVisits: [...(othersBy.get(req.carer_id) ?? []), ...(accepted.get(req.carer_id) ?? [])],
    });
    if (canAssign(result, opts.force)) {
      accepted.set(req.carer_id, [
        ...(accepted.get(req.carer_id) ?? []),
        { id: req.visit.id, start_time: req.visit.start_time, end_time: req.visit.end_time, status: "assigned" },
      ]);
    }
    return result;
  });
}

interface AssignedRow {
  carer_id: string;
  shifts: { id: string; start_time: string; end_time: string; status: string } | { id: string; start_time: string; end_time: string; status: string }[] | null;
}

// ── Availability overview ────────────────────────────────────────────────────

export async function getAvailability(ctx: RosterCtx, from: string, to: string) {
  const { db, orgId } = ctx;
  const start = londonMidnight(parseCalendarDate(from));
  const end = londonMidnight(addDays(parseCalendarDate(to), 1));

  const [carers, absences, blocks, locations] = await Promise.all([
    fetchAll<Record<string, unknown>>((a, b) =>
      db.from("carers").select("id, full_name, status, is_available, availability, max_weekly_hours, contract_hours, location_id, skills, gender").eq("org_id", orgId).order("full_name").range(a, b)),
    fetchAll<Record<string, unknown>>((a, b) =>
      db.from("absences").select("id, carer_id, absence_type, start_date, end_date, status, reason").eq("org_id", orgId).in("status", ["approved", "pending"]).lte("start_date", to).gte("end_date", from).order("start_date").range(a, b)),
    fetchAll<Record<string, unknown>>((a, b) =>
      db.from("carer_unavailability").select("id, carer_id, starts_at, ends_at, reason").eq("org_id", orgId).lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()).order("starts_at").range(a, b)),
    fetchAll<Record<string, unknown>>((a, b) => db.from("locations").select("id, name").eq("org_id", orgId).range(a, b)),
  ]);
  const teamName = new Map(locations.map((l) => [l.id as string, l.name as string]));

  const byCarer = <T extends Record<string, unknown>>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.carer_id as string, [...(m.get(r.carer_id as string) ?? []), r]);
    return m;
  };
  const absencesBy = byCarer(absences);
  const blocksBy = byCarer(blocks);

  return {
    from,
    to,
    carers: carers.map((c) => ({
      carer_id: c.id,
      full_name: c.full_name,
      status: c.status,
      is_available: c.is_available,
      working_hours: c.availability ?? {},
      max_weekly_hours: c.max_weekly_hours,
      contract_hours: c.contract_hours,
      location_id: c.location_id ?? null,
      team: c.location_id ? (teamName.get(c.location_id as string) ?? null) : null,
      skills: c.skills ?? [],
      gender: c.gender ?? null,
      absences: absencesBy.get(c.id as string) ?? [],
      unavailability: blocksBy.get(c.id as string) ?? [],
    })),
  };
}

// ── Working hours ────────────────────────────────────────────────────────────

export async function setWorkingHours(ctx: RosterCtx, carerId: string, hours: z.output<typeof workingHoursSchema>) {
  // Keep only days that have windows; an empty object clears the pattern (= unrestricted).
  const cleaned = Object.fromEntries(Object.entries(hours).filter(([, w]) => Array.isArray(w)));
  const row = unwrap(await ctx.db.from("carers").update({ availability: cleaned }).eq("id", carerId).eq("org_id", ctx.orgId).select("id").maybeSingle());
  if (!row) throw new RosterError("Carer not found", 404);
  return cleaned;
}

// ── Part-day unavailability ──────────────────────────────────────────────────

export async function addUnavailability(ctx: RosterCtx, carerId: string, body: z.output<typeof unavailabilitySchema>) {
  const { db, orgId, adminId } = ctx;
  const carer = unwrap(await db.from("carers").select("id").eq("id", carerId).eq("org_id", orgId).maybeSingle());
  if (!carer) throw new RosterError("Carer not found", 404);

  const wall = (date: string, time: string) => {
    const [h, m] = time.split(":").map(Number);
    return londonWallClockToInstant(parseCalendarDate(date), h, m);
  };
  const startsAt = wall(body.date, body.start_time);
  const endsAt = wall(body.end_date ?? body.date, body.end_time);
  if (endsAt.getTime() <= startsAt.getTime()) throw new RosterError("The block must end after it starts", 400);

  const block = unwrap(await db.from("carer_unavailability")
    .insert({ org_id: orgId, carer_id: carerId, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason: body.reason ?? null, created_by: adminId })
    .select("id, carer_id, starts_at, ends_at, reason").single());

  // Visits the carer is already on during the block: not an error, but the coordinator needs to know.
  const clashing = unwrap(await db.from("shift_assignments")
    .select("shift_id, shifts!inner(start_time, end_time, status)")
    .eq("org_id", orgId).eq("carer_id", carerId)
    .lt("shifts.start_time", endsAt.toISOString()).gt("shifts.end_time", startsAt.toISOString())
    .neq("shifts.status", "cancelled").limit(50)) as { shift_id: string }[] | null;
  return { block, affected_visit_ids: (clashing ?? []).map((r) => r.shift_id) };
}

export async function deleteUnavailability(ctx: RosterCtx, carerId: string, blockId: string) {
  const row = unwrap(await ctx.db.from("carer_unavailability").delete().eq("id", blockId).eq("carer_id", carerId).eq("org_id", ctx.orgId).select("id").maybeSingle());
  if (!row) throw new RosterError("Unavailability block not found", 404);
}

/** Read-only client list for the roster's client view and filters. */
export async function listClients(ctx: RosterCtx) {
  const { db, orgId } = ctx;
  const [clients, locations] = await Promise.all([
    fetchAll<Record<string, unknown>>((a, b) => db.from("clients").select("id, full_name, location_id, postcode, status").eq("org_id", orgId).order("full_name").range(a, b)),
    fetchAll<Record<string, unknown>>((a, b) => db.from("locations").select("id, name").eq("org_id", orgId).range(a, b)),
  ]);
  const teamName = new Map(locations.map((l) => [l.id as string, l.name as string]));
  return {
    clients: clients
      .filter((c) => c.status !== "discharged")
      .map((c) => ({
        id: c.id, full_name: c.full_name, location_id: c.location_id ?? null,
        team: c.location_id ? (teamName.get(c.location_id as string) ?? null) : null, postcode: c.postcode ?? null,
      })),
  };
}
