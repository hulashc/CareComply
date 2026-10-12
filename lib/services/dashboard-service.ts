import { createAdminClient } from "@/lib/supabase/admin";
import {
  addDays,
  londonDayRange,
  londonToday,
  londonWeekRange,
  toDateString,
  type InstantRange,
} from "@/lib/dates/london";
import {
  CARE_PLAN_DUE_SOON_DAYS,
  TRAINING_DUE_SOON_DAYS,
  classifyTiming,
  groupQualifications,
  isMissed,
  summariseWeek,
  type QualificationGroup,
  type ShiftLike,
  type VisitTiming,
  type WeekSummary,
} from "@/lib/dashboard/shift-logic";

type Db = ReturnType<typeof createAdminClient>;

/** Every block fetcher resolves to this and never throws, so Promise.all is safe. */
export type BlockResult<T> = { ok: true; data: T; total: number } | { ok: false; error: string };

// ── Row shapes consumed by the block components ─────────────────────────────

export interface VisitRow {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  carer_id: string | null;
  clientName: string;
  carerName: string | null;
  actual_start: string | null;
  actual_end: string | null;
}

export interface ConflictRow {
  key: string;
  carerId: string;
  carerName: string;
  shiftA: { clientName: string; start: string; end: string };
  shiftB: { clientName: string; start: string; end: string };
  overlapStart: string;
  overlapEnd: string;
}

export interface TimeOffRow {
  id: string;
  carerId: string;
  carerName: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface WeekStats extends WeekSummary {
  openIncidents: number;
  rangeLabel: { startDate: string; endDate: string };
}

export interface TimingRow {
  id: string;
  clientName: string;
  carerName: string | null;
  start_time: string;
  end_time: string;
  actual_start: string | null;
  actual_end: string | null;
  timing: VisitTiming;
}

export interface TimingData {
  /** Late / short / not-checked-out visits from the last 7 days, most recent first. */
  flagged: TimingRow[];
  /** All visits in the window with a recorded check-in. */
  recorded: number;
}

export interface CarePlanRow {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  reviewDate: string;
}

export interface ChecklistRow {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  priority: string;
  dueDate: string | null;
}

export interface DashboardOperations {
  today: string;
  diaryToday: BlockResult<VisitRow[]>;
  unassigned: BlockResult<VisitRow[]>;
  conflicts: BlockResult<ConflictRow[]>;
  training: BlockResult<QualificationGroup[]>;
  timeOff: BlockResult<TimeOffRow[]>;
  week: BlockResult<WeekStats>;
  diaryTomorrow: BlockResult<VisitRow[]>;
  actualTimes: BlockResult<TimingData>;
  carePlans: BlockResult<CarePlanRow[]>;
  checklists: BlockResult<ChecklistRow[]>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const MAX_ROWS_FETCHED = 500;
const NAME_FALLBACK = "Unknown";

async function safe<T>(label: string, fn: () => Promise<BlockResult<T>>): Promise<BlockResult<T>> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `${label}: ${message}` };
  }
}

function fail(label: string, error: { message: string }): { ok: false; error: string } {
  return { ok: false, error: `${label}: ${error.message}` };
}

async function loadNames(db: Db, table: "clients" | "carers", ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();
  const { data } = await db.from(table).select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((r) => [r.id, r.full_name]));
}

type ShiftRow = {
  id: string;
  client_id: string;
  carer_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  actual_start: string | null;
  actual_end: string | null;
};

const SHIFT_COLUMNS = "id, client_id, carer_id, start_time, end_time, status, actual_start, actual_end";

async function toVisitRows(db: Db, shifts: ShiftRow[]): Promise<VisitRow[]> {
  const [clients, carers] = await Promise.all([
    loadNames(db, "clients", shifts.map((s) => s.client_id)),
    loadNames(db, "carers", shifts.map((s) => s.carer_id)),
  ]);
  return shifts.map((s) => ({
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time,
    status: s.status,
    carer_id: s.carer_id,
    clientName: clients.get(s.client_id) ?? NAME_FALLBACK,
    carerName: s.carer_id ? (carers.get(s.carer_id) ?? NAME_FALLBACK) : null,
    actual_start: s.actual_start,
    actual_end: s.actual_end,
  }));
}

// ── Block fetchers ──────────────────────────────────────────────────────────

async function fetchDiary(db: Db, orgId: string, range: InstantRange, label: string): Promise<BlockResult<VisitRow[]>> {
  const { data, error } = await db
    .from("shifts")
    .select(SHIFT_COLUMNS)
    .eq("org_id", orgId)
    .neq("status", "cancelled")
    .gte("start_time", range.start.toISOString())
    .lt("start_time", range.end.toISOString())
    .order("start_time", { ascending: true })
    .limit(MAX_ROWS_FETCHED);
  if (error) return fail(label, error);
  const rows = await toVisitRows(db, data ?? []);
  return { ok: true, data: rows, total: rows.length };
}

async function fetchUnassigned(db: Db, orgId: string): Promise<BlockResult<VisitRow[]>> {
  const { data, error, count } = await db
    .from("v_unassigned_shifts")
    .select("id, client_id, start_time, end_time, status", { count: "exact" })
    .eq("org_id", orgId)
    .order("start_time", { ascending: true })
    .limit(5);
  if (error) return fail("unassigned", error);
  const shifts: ShiftRow[] = (data ?? []).flatMap((s) =>
    s.id && s.client_id && s.start_time && s.end_time && s.status
      ? [{ id: s.id, client_id: s.client_id, carer_id: null, start_time: s.start_time, end_time: s.end_time, status: s.status, actual_start: null, actual_end: null }]
      : [],
  );
  const rows = await toVisitRows(db, shifts);
  return { ok: true, data: rows, total: count ?? rows.length };
}

async function fetchConflicts(db: Db, orgId: string, now: Date): Promise<BlockResult<ConflictRow[]>> {
  const horizon = new Date(now.getTime() + 14 * 86_400_000);
  const { data, error, count } = await db
    .from("v_carer_shift_conflicts")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .gt("overlap_end", now.toISOString())
    .lt("overlap_start", horizon.toISOString())
    .order("overlap_start", { ascending: true })
    .limit(5);
  if (error) return fail("conflicts", error);

  const pairs = (data ?? []).flatMap((c) =>
    c.carer_id && c.shift_a_id && c.shift_b_id && c.shift_a_start && c.shift_a_end && c.shift_b_start && c.shift_b_end && c.overlap_start && c.overlap_end
      ? [{
          carerId: c.carer_id,
          aId: c.shift_a_id,
          bId: c.shift_b_id,
          aClient: c.shift_a_client_id,
          bClient: c.shift_b_client_id,
          aStart: c.shift_a_start,
          aEnd: c.shift_a_end,
          bStart: c.shift_b_start,
          bEnd: c.shift_b_end,
          overlapStart: c.overlap_start,
          overlapEnd: c.overlap_end,
        }]
      : [],
  );
  const [carers, clients] = await Promise.all([
    loadNames(db, "carers", pairs.map((p) => p.carerId)),
    loadNames(db, "clients", pairs.flatMap((p) => [p.aClient, p.bClient])),
  ]);
  const rows: ConflictRow[] = pairs.map((p) => ({
    key: `${p.aId}:${p.bId}`,
    carerId: p.carerId,
    carerName: carers.get(p.carerId) ?? NAME_FALLBACK,
    shiftA: { clientName: (p.aClient && clients.get(p.aClient)) || NAME_FALLBACK, start: p.aStart, end: p.aEnd },
    shiftB: { clientName: (p.bClient && clients.get(p.bClient)) || NAME_FALLBACK, start: p.bStart, end: p.bEnd },
    overlapStart: p.overlapStart,
    overlapEnd: p.overlapEnd,
  }));
  return { ok: true, data: rows, total: count ?? rows.length };
}

async function fetchTraining(db: Db, orgId: string, today: string): Promise<BlockResult<QualificationGroup[]>> {
  const cutoff = toDateString(addDays(londonToday(), TRAINING_DUE_SOON_DAYS));
  const { data, error } = await db
    .from("qualifications")
    .select("carer_id, qualification_type, expiry_date")
    .eq("org_id", orgId)
    .not("expiry_date", "is", null)
    .lte("expiry_date", cutoff)
    .limit(MAX_ROWS_FETCHED);
  if (error) return fail("training", error);
  const groups = groupQualifications(data ?? [], today);
  const total = groups.reduce((sum, g) => sum + g.expired + g.expiring, 0);
  return { ok: true, data: groups, total };
}

async function fetchTimeOff(db: Db, orgId: string): Promise<BlockResult<TimeOffRow[]>> {
  const { data, error, count } = await db
    .from("absences")
    .select("id, carer_id, absence_type, start_date, end_date, reason", { count: "exact" })
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("start_date", { ascending: true })
    .limit(5);
  if (error) return fail("time_off", error);
  const carers = await loadNames(db, "carers", (data ?? []).map((a) => a.carer_id));
  const rows: TimeOffRow[] = (data ?? []).map((a) => ({
    id: a.id,
    carerId: a.carer_id,
    carerName: carers.get(a.carer_id) ?? NAME_FALLBACK,
    absenceType: a.absence_type,
    startDate: a.start_date,
    endDate: a.end_date,
    reason: a.reason,
  }));
  return { ok: true, data: rows, total: count ?? rows.length };
}

async function fetchWeek(db: Db, orgId: string, now: Date): Promise<BlockResult<WeekStats>> {
  const week = londonWeekRange(now);
  const [shiftsRes, incidentsRes] = await Promise.all([
    db
      .from("shifts")
      .select("id, carer_id, start_time, end_time, status, actual_start")
      .eq("org_id", orgId)
      .gte("start_time", week.start.toISOString())
      .lt("start_time", week.end.toISOString())
      .limit(MAX_ROWS_FETCHED * 4),
    db.from("incidents").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open"),
  ]);
  if (shiftsRes.error) return fail("week", shiftsRes.error);
  if (incidentsRes.error) return fail("week_incidents", incidentsRes.error);
  const summary = summariseWeek(shiftsRes.data ?? [], now);
  return {
    ok: true,
    data: { ...summary, openIncidents: incidentsRes.count ?? 0, rangeLabel: { startDate: week.startDate, endDate: week.endDate } },
    total: summary.visits,
  };
}

async function fetchActualTimes(db: Db, orgId: string, now: Date): Promise<BlockResult<TimingData>> {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const { data, error } = await db
    .from("shifts")
    .select(SHIFT_COLUMNS)
    .eq("org_id", orgId)
    .not("actual_start", "is", null)
    .gte("actual_start", since.toISOString())
    .order("actual_start", { ascending: false })
    .limit(MAX_ROWS_FETCHED);
  if (error) return fail("actual_times", error);

  const shifts = data ?? [];
  const classified = shifts.flatMap((s) => {
    const timing = classifyTiming(s, now);
    return timing && timing.urgency.level !== "green" ? [{ s, timing }] : [];
  });
  const visits = await toVisitRows(db, classified.map((c) => c.s));
  const flagged: TimingRow[] = classified.map((c, i) => ({
    id: c.s.id,
    clientName: visits[i].clientName,
    carerName: visits[i].carerName,
    start_time: c.s.start_time,
    end_time: c.s.end_time,
    actual_start: c.s.actual_start,
    actual_end: c.s.actual_end,
    timing: c.timing,
  }));
  return { ok: true, data: { flagged, recorded: shifts.length }, total: flagged.length };
}

async function fetchCarePlans(db: Db, orgId: string): Promise<BlockResult<CarePlanRow[]>> {
  const cutoff = toDateString(addDays(londonToday(), CARE_PLAN_DUE_SOON_DAYS));
  const { data, error, count } = await db
    .from("care_plans")
    .select("id, client_id, title, review_date", { count: "exact" })
    .eq("org_id", orgId)
    .eq("status", "active")
    .not("review_date", "is", null)
    .lte("review_date", cutoff)
    .order("review_date", { ascending: true })
    .limit(5);
  if (error) return fail("care_plans", error);
  const clients = await loadNames(db, "clients", (data ?? []).map((p) => p.client_id));
  const rows = (data ?? []).flatMap((p) =>
    p.review_date
      ? [{ id: p.id, clientId: p.client_id, clientName: clients.get(p.client_id) ?? NAME_FALLBACK, title: p.title, reviewDate: p.review_date }]
      : [],
  );
  return { ok: true, data: rows, total: count ?? rows.length };
}

async function fetchChecklists(db: Db, orgId: string): Promise<BlockResult<ChecklistRow[]>> {
  const { data, error, count } = await db
    .from("tasks")
    .select("id, client_id, title, priority, due_date", { count: "exact" })
    .eq("org_id", orgId)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5);
  if (error) return fail("checklists", error);
  const clients = await loadNames(db, "clients", (data ?? []).map((t) => t.client_id));
  const rows: ChecklistRow[] = (data ?? []).map((t) => ({
    id: t.id,
    clientId: t.client_id,
    clientName: clients.get(t.client_id) ?? NAME_FALLBACK,
    title: t.title,
    priority: t.priority,
    dueDate: t.due_date,
  }));
  return { ok: true, data: rows, total: count ?? rows.length };
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function loadDashboardOperations(orgId: string, now: Date = new Date()): Promise<DashboardOperations> {
  const db = createAdminClient();
  const todayRange = londonDayRange(0, now);
  const tomorrowRange = londonDayRange(1, now);
  const today = todayRange.date;

  const [diaryToday, unassigned, conflicts, training, timeOff, week, diaryTomorrow, actualTimes, carePlans, checklists] =
    await Promise.all([
      safe("diary_today", () => fetchDiary(db, orgId, todayRange, "diary_today")),
      safe("unassigned", () => fetchUnassigned(db, orgId)),
      safe("conflicts", () => fetchConflicts(db, orgId, now)),
      safe("training", () => fetchTraining(db, orgId, today)),
      safe("time_off", () => fetchTimeOff(db, orgId)),
      safe("week", () => fetchWeek(db, orgId, now)),
      safe("diary_tomorrow", () => fetchDiary(db, orgId, tomorrowRange, "diary_tomorrow")),
      safe("actual_times", () => fetchActualTimes(db, orgId, now)),
      safe("care_plans", () => fetchCarePlans(db, orgId)),
      safe("checklists", () => fetchChecklists(db, orgId)),
    ]);

  return { today, diaryToday, unassigned, conflicts, training, timeOff, week, diaryTomorrow, actualTimes, carePlans, checklists };
}

// Re-exported so block components can import shift helpers from one place.
export { isMissed };
export type { ShiftLike };
