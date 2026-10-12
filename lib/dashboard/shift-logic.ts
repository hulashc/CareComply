// Pure dashboard logic: no I/O, so it can be unit-tested and reused.
// Conflict semantics mirror the v_carer_shift_conflicts view (half-open ranges).

export const LATE_THRESHOLD_MINUTES = 15;
export const SHORT_VISIT_RATIO = 0.8;
export const CARE_PLAN_DUE_SOON_DAYS = 14;
export const TRAINING_DUE_SOON_DAYS = 30;

export type UrgencyLevel = "red" | "amber" | "green";

export interface Urgency {
  level: UrgencyLevel;
  label: string;
}

export interface ShiftLike {
  id: string;
  carer_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  actual_start?: string | null;
  actual_end?: string | null;
}

const ms = (iso: string) => new Date(iso).getTime();
const MINUTE = 60_000;
const DAY = 86_400_000;

// ── Conflicts ────────────────────────────────────────────────────────────────

/** Half-open [start, end) overlap: back-to-back visits do not overlap. */
export function overlaps(a: Pick<ShiftLike, "start_time" | "end_time">, b: Pick<ShiftLike, "start_time" | "end_time">): boolean {
  return ms(a.start_time) < ms(b.end_time) && ms(b.start_time) < ms(a.end_time);
}

export interface ConflictPair<T extends ShiftLike = ShiftLike> {
  carerId: string;
  a: T;
  b: T;
  overlapStart: string;
  overlapEnd: string;
}

/** Every overlapping pair of non-cancelled shifts for the same carer, earliest overlap first. */
export function findCarerConflicts<T extends ShiftLike>(shifts: T[]): ConflictPair<T>[] {
  const byCarer = new Map<string, T[]>();
  for (const s of shifts) {
    if (!s.carer_id || s.status === "cancelled") continue;
    const list = byCarer.get(s.carer_id) ?? [];
    list.push(s);
    byCarer.set(s.carer_id, list);
  }

  const pairs: ConflictPair<T>[] = [];
  for (const [carerId, list] of byCarer) {
    list.sort((x, y) => ms(x.start_time) - ms(y.start_time));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        // Sorted by start: once j starts at/after i ends, no later j can overlap i.
        if (ms(list[j].start_time) >= ms(list[i].end_time)) break;
        if (overlaps(list[i], list[j])) {
          pairs.push({
            carerId,
            a: list[i],
            b: list[j],
            overlapStart: new Date(Math.max(ms(list[i].start_time), ms(list[j].start_time))).toISOString(),
            overlapEnd: new Date(Math.min(ms(list[i].end_time), ms(list[j].end_time))).toISOString(),
          });
        }
      }
    }
  }
  return pairs.sort((p, q) => ms(p.overlapStart) - ms(q.overlapStart));
}

// ── Unassigned ───────────────────────────────────────────────────────────────

/** Shifts with no carer that haven't ended, soonest first (mirrors v_unassigned_shifts). */
export function selectUnassigned<T extends ShiftLike>(shifts: T[], now: Date = new Date()): T[] {
  return shifts
    .filter((s) => s.carer_id === null && s.status !== "cancelled" && ms(s.end_time) > now.getTime())
    .sort((a, b) => ms(a.start_time) - ms(b.start_time));
}

export function unassignedUrgency(startIso: string, now: Date = new Date()): Urgency {
  const hoursAway = (ms(startIso) - now.getTime()) / (60 * MINUTE);
  if (hoursAway <= 0) return { level: "red", label: "Started" };
  if (hoursAway <= 24) return { level: "red", label: "Within 24h" };
  if (hoursAway <= 72) return { level: "amber", label: "Within 3 days" };
  return { level: "green", label: "Upcoming" };
}

// ── Actual vs planned times ──────────────────────────────────────────────────

export interface VisitTiming {
  lateMinutes: number;
  actualMinutes: number | null;
  plannedMinutes: number;
  late: boolean;
  short: boolean;
  urgency: Urgency;
}

export function classifyTiming(shift: ShiftLike, now: Date = new Date()): VisitTiming | null {
  if (!shift.actual_start) return null;
  const plannedMinutes = Math.round((ms(shift.end_time) - ms(shift.start_time)) / MINUTE);
  const lateMinutes = Math.round((ms(shift.actual_start) - ms(shift.start_time)) / MINUTE);
  const actualMinutes = shift.actual_end
    ? Math.round((ms(shift.actual_end) - ms(shift.actual_start)) / MINUTE)
    : null;

  const late = lateMinutes > LATE_THRESHOLD_MINUTES;
  const short = actualMinutes !== null && actualMinutes < plannedMinutes * SHORT_VISIT_RATIO;
  const notCheckedOut = actualMinutes === null && ms(shift.end_time) < now.getTime();

  let urgency: Urgency;
  if (late && short) urgency = { level: "red", label: "Late & short" };
  else if (late) urgency = { level: "amber", label: `Late ${lateMinutes}m` };
  else if (short) urgency = { level: "amber", label: "Short visit" };
  else if (notCheckedOut) urgency = { level: "amber", label: "No check-out" };
  else urgency = { level: "green", label: "On time" };

  return { lateMinutes, actualMinutes, plannedMinutes, late, short, urgency };
}

// ── Diary / week stats ───────────────────────────────────────────────────────

export function isMissed(shift: ShiftLike, now: Date = new Date()): boolean {
  if (shift.status === "missed") return true;
  return shift.status === "scheduled" && !shift.actual_start && ms(shift.end_time) < now.getTime();
}

export function visitStatus(shift: ShiftLike, now: Date = new Date()): Urgency {
  if (!shift.carer_id) return { level: "red", label: "Unassigned" };
  if (isMissed(shift, now)) return { level: "red", label: "Missed" };
  switch (shift.status) {
    case "completed":
      return { level: "green", label: "Completed" };
    case "in_progress":
      return { level: "green", label: "In progress" };
    case "cancelled":
      return { level: "amber", label: "Cancelled" };
  }
  const minsLate = (now.getTime() - ms(shift.start_time)) / MINUTE;
  if (!shift.actual_start && minsLate > LATE_THRESHOLD_MINUTES) return { level: "amber", label: "Not started" };
  return { level: "green", label: "Scheduled" };
}

export interface WeekSummary {
  visits: number;
  plannedHours: number;
  completed: number;
  missed: number;
}

export function summariseWeek(shifts: ShiftLike[], now: Date = new Date()): WeekSummary {
  let visits = 0;
  let plannedMinutes = 0;
  let completed = 0;
  let missed = 0;
  for (const s of shifts) {
    if (s.status === "cancelled") continue;
    visits++;
    plannedMinutes += (ms(s.end_time) - ms(s.start_time)) / MINUTE;
    if (s.status === "completed") completed++;
    else if (isMissed(s, now)) missed++;
  }
  return { visits, plannedHours: Math.round((plannedMinutes / 60) * 10) / 10, completed, missed };
}

// ── Date-only urgency (qualifications, care plans, tasks) ───────────────────

/** Whole days from `today` to `date`, both YYYY-MM-DD (negative = past). */
export function daysBetween(today: string, date: string): number {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = date.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
}

export function reviewUrgency(reviewDate: string, today: string): Urgency {
  const days = daysBetween(today, reviewDate);
  if (days < 0) return { level: "red", label: `Overdue ${-days}d` };
  if (days === 0) return { level: "amber", label: "Due today" };
  if (days <= CARE_PLAN_DUE_SOON_DAYS) return { level: "amber", label: `Due in ${days}d` };
  return { level: "green", label: "On track" };
}

export function taskUrgency(dueDate: string | null, today: string): Urgency {
  if (!dueDate) return { level: "green", label: "No due date" };
  const days = daysBetween(today, dueDate);
  if (days < 0) return { level: "red", label: `Overdue ${-days}d` };
  if (days === 0) return { level: "amber", label: "Due today" };
  if (days <= 2) return { level: "amber", label: `Due in ${days}d` };
  return { level: "green", label: `Due in ${days}d` };
}

export interface QualificationLike {
  carer_id: string;
  qualification_type: string;
  expiry_date: string | null;
}

export interface QualificationGroup {
  type: string;
  expired: number;
  expiring: number;
  /** Carer with the most urgent expiry in this group (for the quick action link). */
  mostUrgentCarerId: string;
  soonestExpiry: string;
  urgency: Urgency;
}

/** Per-qualification-type summary of expired / expiring-soon records, most urgent first. */
export function groupQualifications(quals: QualificationLike[], today: string): QualificationGroup[] {
  const groups = new Map<string, QualificationGroup>();
  for (const q of quals) {
    if (!q.expiry_date) continue;
    const days = daysBetween(today, q.expiry_date);
    if (days > TRAINING_DUE_SOON_DAYS) continue;
    const g = groups.get(q.qualification_type) ?? {
      type: q.qualification_type,
      expired: 0,
      expiring: 0,
      mostUrgentCarerId: q.carer_id,
      soonestExpiry: q.expiry_date,
      urgency: { level: "amber", label: "" },
    };
    if (days < 0) g.expired++;
    else g.expiring++;
    if (q.expiry_date < g.soonestExpiry) {
      g.soonestExpiry = q.expiry_date;
      g.mostUrgentCarerId = q.carer_id;
    }
    groups.set(q.qualification_type, g);
  }
  for (const g of groups.values()) {
    const parts = [g.expired ? `${g.expired} expired` : "", g.expiring ? `${g.expiring} due` : ""].filter(Boolean);
    g.urgency = { level: g.expired ? "red" : "amber", label: parts.join(" · ") };
  }
  return [...groups.values()].sort(
    (a, b) => b.expired - a.expired || b.expiring - a.expiring || a.soonestExpiry.localeCompare(b.soonestExpiry),
  );
}
