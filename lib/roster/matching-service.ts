import { addDays, londonMidnight, parseCalendarDate, londonDateOf } from "../dates/london";
import { fetchAll, inChunks, unwrap } from "./db";
import { weekKey, type EligibilityAbsence } from "./eligibility";
import { RosterError } from "./errors";
import type { RosterCtx } from "./http";
import { rankCandidates } from "./matching/engine";
import { CONTINUITY_LOOKBACK_DAYS } from "./matching/factors";
import { excludedReason, topReason } from "./matching/summary";
import type { Candidate, CarerVisit, MatchCarer, MatchClient, MatchInput } from "./matching/types";
import { getSettings } from "./profile-service";
import type { TransportMode, VisitRow } from "./types";

// Loads everything the pure matching engine (lib/roster/matching) needs for one visit, with a
// fixed number of queries, and returns its top suggestions (suggestCarers) or a compact score for
// every carer (scoreAllCarers, the drag-preview heat map).

const IN_CHUNK = 100;
const DAY_MS = 86_400_000;

export interface MatchWindow {
  /** A hypothetical time for the visit (the drag preview); defaults to the visit's own. */
  at?: { start_time: string; end_time: string };
  /** A carer to treat as not on the visit, so they can be scored as a drop target too. */
  asIfUnassigned?: string | null;
}

export async function suggestCarers(ctx: RosterCtx, visitId: string, limit: number) {
  const { visit, input } = await loadMatchInput(ctx, visitId);
  const ranked = rankCandidates(input);
  return {
    visit_id: visit.id,
    open_slots: visit.open_slots,
    weights: input.weights,
    candidates: ranked.candidates.slice(0, limit),
    excluded_count: ranked.excluded.length,
    excluded: ranked.excluded.map((e) => ({ carer_id: e.carer_id, full_name: e.full_name, ...excludedReason(e) })),
  };
}

export type CarerScore =
  | { excluded: false; total: number; reason: string | null; warnings: string[] }
  | { excluded: true; reason: string; message: string };

/** Compact score for every carer at one time slot: the drag-preview heat map. One load, one ranking. */
export async function scoreAllCarers(ctx: RosterCtx, visitId: string, window: MatchWindow = {}) {
  const { visit, input } = await loadMatchInput(ctx, visitId, window);
  const ranked = rankCandidates(input);
  const scores: Record<string, CarerScore> = {};
  for (const c of ranked.candidates) {
    scores[c.carer_id] = { excluded: false, total: c.total, reason: topReason(c), warnings: c.warnings };
  }
  for (const e of ranked.excluded) {
    const r = excludedReason(e);
    scores[e.carer_id] = { excluded: true, reason: r.short, message: r.message };
  }
  return { visit_id: visit.id, start_time: visit.start_time, end_time: visit.end_time, scores };
}

async function loadMatchInput(ctx: RosterCtx, visitId: string, window: MatchWindow = {}): Promise<{ visit: VisitRow; input: MatchInput }> {
  const { db, orgId } = ctx;
  const loaded = unwrap(await db.from("v_roster_visits").select("*").eq("org_id", orgId).eq("id", visitId).maybeSingle()) as VisitRow | null;
  if (!loaded) throw new RosterError("Visit not found", 404);
  if (loaded.status === "cancelled" || loaded.status === "completed") {
    throw new RosterError(`Cannot suggest carers for a ${loaded.status} visit`, 409);
  }
  const visit: VisitRow = window.at ? { ...loaded, ...window.at } : loaded;

  const start = new Date(visit.start_time);
  const weekStart = londonMidnight(parseCalendarDate(weekKey(visit.start_time)));
  const weekEnd = londonMidnight(addDays(parseCalendarDate(weekKey(visit.end_time)), 7));
  const historyFrom = new Date(start.getTime() - CONTINUITY_LOOKBACK_DAYS * DAY_MS);
  const firstDay = londonDateOf(start);
  const lastDay = londonDateOf(new Date(new Date(visit.end_time).getTime() - 1));

  const [client, prefs, carers, { weights }] = await Promise.all([
    db.from("clients").select("id, full_name, title, preferred_carer_gender, carer_gender_required, prefers_non_smoking_carer, pets, primary_language, lat, lng, key_worker_id")
      .eq("org_id", orgId).eq("id", visit.client_id).maybeSingle().then(unwrap),
    fetchAll<{ carer_id: string; kind: "preferred" | "excluded" }>((a, b) =>
      db.from("client_carer_preferences").select("carer_id, kind").eq("org_id", orgId).eq("client_id", visit.client_id).range(a, b)),
    fetchAll<Record<string, unknown>>((a, b) =>
      db.from("carers")
        .select("id, full_name, status, is_available, gender, skills, languages, pet_allergies, is_smoker, max_weekly_hours, contract_hours, availability, lat, lng, transport_mode, driving_licence, has_vehicle, start_date")
        .eq("org_id", orgId).order("id").range(a, b)),
    getSettings(ctx),
  ]);
  if (!client) throw new RosterError("Client not found", 404);

  const carerIds = carers.map((c) => c.id as string);
  const [absences, blocks, weekRows, historyRows] = await Promise.all([
    inChunks(carerIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("absences").select("carer_id, absence_type, start_date, end_date, status").eq("org_id", orgId).in("carer_id", ids).in("status", ["approved", "pending"]).lte("start_date", lastDay).gte("end_date", firstDay)) ?? []),
    inChunks(carerIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("carer_unavailability").select("carer_id, starts_at, ends_at").eq("org_id", orgId).in("carer_id", ids).lt("starts_at", visit.end_time).gt("ends_at", visit.start_time)) ?? []),
    inChunks(carerIds, IN_CHUNK, (ids) =>
      fetchAll<AssignedRow>((a, b) =>
        db.from("shift_assignments").select("carer_id, shifts!inner(id, client_id, start_time, end_time, status)")
          .eq("org_id", orgId).in("carer_id", ids)
          .gte("shifts.start_time", weekStart.toISOString()).lt("shifts.start_time", weekEnd.toISOString())
          .order("shift_id").range(a, b))),
    fetchAll<AssignedRow>((a, b) =>
      db.from("shift_assignments").select("carer_id, shifts!inner(id, client_id, start_time, end_time, status)")
        .eq("org_id", orgId).eq("shifts.client_id", visit.client_id)
        .gte("shifts.start_time", historyFrom.toISOString()).lt("shifts.start_time", visit.start_time)
        .order("shift_id").range(a, b)),
  ]);

  // Locations of the other clients the carers visit that week, for travel between visits.
  const shiftOf = (r: AssignedRow) => (Array.isArray(r.shifts) ? r.shifts[0] : r.shifts) ?? null;
  const otherClientIds = [...new Set(weekRows.map((r) => shiftOf(r)?.client_id).filter((id): id is string => !!id))];
  const coords = new Map<string, { lat: number | null; lng: number | null }>(
    (await inChunks(otherClientIds, IN_CHUNK, async (ids) =>
      unwrap(await db.from("clients").select("id, lat, lng").eq("org_id", orgId).in("id", ids)) ?? [])
    ).map((c: { id: string; lat: number | null; lng: number | null }) => [c.id, c]),
  );

  const byCarer = <T>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  const absencesBy = byCarer(absences as (EligibilityAbsence & { carer_id: string })[], (r) => r.carer_id);
  const blocksBy = byCarer(blocks as { carer_id: string; starts_at: string; ends_at: string }[], (r) => r.carer_id);
  const weekBy = byCarer(weekRows, (r) => r.carer_id);
  const historyBy = byCarer(historyRows, (r) => r.carer_id);
  const prefBy = new Map(prefs.map((p) => [p.carer_id, p.kind]));

  const c = client as Record<string, unknown>;
  const matchClient: MatchClient = {
    id: c.id as string,
    full_name: (c.full_name as string) ?? null,
    display_name: displayName(c.title as string | null, c.full_name as string | null),
    preferred_carer_gender: (c.preferred_carer_gender as string | null) ?? null,
    carer_gender_required: Boolean(c.carer_gender_required),
    prefers_non_smoking_carer: Boolean(c.prefers_non_smoking_carer),
    pets: (c.pets as string[]) ?? [],
    primary_language: (c.primary_language as string | null) ?? null,
    lat: (c.lat as number | null) ?? null,
    lng: (c.lng as number | null) ?? null,
    key_worker_id: (c.key_worker_id as string | null) ?? null,
    has_preferred_carers: prefs.some((p) => p.kind === "preferred"),
  };

  const candidates: Candidate[] = carers.map((row) => {
    const id = row.id as string;
    const carer: MatchCarer = {
      id,
      full_name: (row.full_name as string) ?? "",
      status: (row.status as string | null) ?? null,
      is_available: (row.is_available as boolean | null) ?? null,
      gender: (row.gender as string | null) ?? null,
      skills: (row.skills as string[]) ?? [],
      languages: (row.languages as string[]) ?? [],
      pet_allergies: (row.pet_allergies as string[]) ?? [],
      is_smoker: Boolean(row.is_smoker),
      max_weekly_hours: (row.max_weekly_hours as number | null) ?? null,
      contract_hours: (row.contract_hours as number | null) ?? null,
      availability: row.availability ?? null,
      lat: (row.lat as number | null) ?? null,
      lng: (row.lng as number | null) ?? null,
      transport_mode: (row.transport_mode as TransportMode | null) ?? null,
      driving_licence: Boolean(row.driving_licence),
      has_vehicle: Boolean(row.has_vehicle),
      start_date: (row.start_date as string | null) ?? null,
    };
    const otherVisits: CarerVisit[] = (weekBy.get(id) ?? []).map(shiftOf).filter((s): s is ShiftRef => !!s).map((s) => ({
      id: s.id, start_time: s.start_time, end_time: s.end_time, status: s.status,
      lat: coords.get(s.client_id)?.lat ?? null, lng: coords.get(s.client_id)?.lng ?? null,
    }));
    return {
      carer,
      preference: prefBy.get(id) ?? null,
      absences: absencesBy.get(id) ?? [],
      unavailability: blocksBy.get(id) ?? [],
      otherVisits,
      history: (historyBy.get(id) ?? []).map(shiftOf).filter((s): s is ShiftRef => !!s).map((s) => ({ start_time: s.start_time, status: s.status })),
    };
  });

  const input: MatchInput = {
    visit: {
      id: visit.id, client_id: visit.client_id, start_time: visit.start_time, end_time: visit.end_time,
      required_skills: visit.required_skills ?? [],
      assigned_carer_ids: (visit.carers ?? []).map((x) => x.carer_id).filter((id) => id !== window.asIfUnassigned),
    },
    client: matchClient,
    candidates,
    weights,
  };
  return { visit, input };
}

/** "Mrs Patel" when a title is recorded, else the full name. */
function displayName(title: string | null, fullName: string | null): string | null {
  const surname = fullName?.trim().split(/\s+/).pop();
  return title?.trim() && surname ? `${title.trim()} ${surname}` : fullName;
}

interface ShiftRef {
  id: string;
  client_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface AssignedRow {
  carer_id: string;
  shifts: ShiftRef | ShiftRef[] | null;
}
