import { overlaps } from "../dashboard/shift-logic";
import { SAME_PERSON_MESSAGE, isSamePerson } from "./same-person";
import {
  addDays,
  isoWeekdayOf,
  londonDateOf,
  londonMidnight,
  londonParts,
  parseCalendarDate,
  toDateString,
} from "../dates/london";

// Can this carer go on this visit? A pure function, so the API and (later) the matching engine
// share one set of rules. It does NOT score or rank; scoring is a later phase and will use these
// as its hard filters.
//
// Three tiers, by how much judgement is left to the coordinator:
//   blocked      never allowed: client safety / dignity / legal (exclusion list, leave, gender
//                requirement) or the carer is not rosterable
//   overridable  normally rejected, but a coordinator can pass force=true when they know better
//                (overlap, missing skill, ...); the override is audited
//   warnings     allowed, shown as information

export type IssueCode =
  | "EXCLUDED_CARER"
  | "CARER_INACTIVE"
  | "SAME_PERSON"
  | "ON_LEAVE"
  | "GENDER_REQUIRED"
  | "OVERLAP"
  | "UNAVAILABLE"
  | "MISSING_SKILL"
  | "PET_ALLERGY"
  | "OVER_WEEKLY_HOURS"
  | "OUTSIDE_WORKING_HOURS"
  | "LEAVE_PENDING"
  | "PREFERS_NON_SMOKER"
  | "GENDER_PREFERENCE";

export interface Issue {
  code: IssueCode;
  message: string;
}

export interface Eligibility {
  blocked: Issue[];
  overridable: Issue[];
  warnings: Issue[];
  /** On the client's preferred list (informational; scoring uses it later). */
  preferred: boolean;
}

export interface EligibilityCarer {
  id: string;
  full_name?: string | null;
  status: string | null;
  is_available: boolean | null;
  gender: string | null;
  skills: string[];
  pet_allergies: string[];
  is_smoker: boolean;
  max_weekly_hours: number | null;
  /** carers.availability: weekly working hours, see parseWorkingHours. */
  availability: unknown;
}

export interface EligibilityClient {
  id?: string;
  full_name?: string | null;
  preferred_carer_gender: string | null;
  carer_gender_required: boolean;
  prefers_non_smoking_carer: boolean;
  pets: string[];
}

export interface EligibilityVisit {
  id: string;
  start_time: string;
  end_time: string;
  required_skills: string[];
}

export interface EligibilityAbsence {
  absence_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface EligibilityInput {
  carer: EligibilityCarer;
  client: EligibilityClient;
  visit: EligibilityVisit;
  preference: "preferred" | "excluded" | null;
  absences: EligibilityAbsence[];
  unavailability: { starts_at: string; ends_at: string }[];
  /** The carer's other visits around this one (any status; cancelled and this visit are ignored). */
  otherVisits: { id: string; start_time: string; end_time: string; status: string }[];
}

export function checkEligibility(input: EligibilityInput): Eligibility {
  const { carer, client, visit } = input;
  const blocked: Issue[] = [];
  const overridable: Issue[] = [];
  const warnings: Issue[] = [];
  const start = new Date(visit.start_time);
  const end = new Date(visit.end_time);

  // ── blocked ──
  if (isSamePerson({ id: client.id, name: client.full_name }, { id: carer.id, name: carer.full_name })) {
    blocked.push({ code: "SAME_PERSON", message: SAME_PERSON_MESSAGE });
  }
  if (input.preference === "excluded") {
    blocked.push({ code: "EXCLUDED_CARER", message: "This carer is on the client's do-not-pair list" });
  }
  if ((carer.status && carer.status.toLowerCase() !== "active") || carer.is_available === false) {
    blocked.push({ code: "CARER_INACTIVE", message: "This carer is not currently active for rostering" });
  }

  // Leave is whole days (London). A visit that ends exactly at midnight does not touch the next day.
  const firstDay = londonDateOf(start);
  const lastDay = londonDateOf(new Date(end.getTime() - 1));
  for (const a of input.absences) {
    if (a.start_date > lastDay || a.end_date < firstDay) continue;
    const label = a.absence_type.replace(/_/g, " ");
    if (a.status === "approved") {
      blocked.push({ code: "ON_LEAVE", message: `Carer is on approved ${label} (${a.start_date} to ${a.end_date})` });
    } else if (a.status === "pending") {
      warnings.push({ code: "LEAVE_PENDING", message: `Carer has a pending ${label} request (${a.start_date} to ${a.end_date})` });
    }
  }

  const carerGender = normaliseGender(carer.gender);
  const wanted = normaliseGender(client.preferred_carer_gender);
  if (wanted) {
    if (client.carer_gender_required) {
      if (carerGender !== wanted) {
        blocked.push({
          code: "GENDER_REQUIRED",
          message: carerGender
            ? `Client requires a ${wanted} carer`
            : `Client requires a ${wanted} carer and this carer's gender is not recorded`,
        });
      }
    } else if (carerGender !== wanted) {
      warnings.push({ code: "GENDER_PREFERENCE", message: `Client prefers a ${wanted} carer` });
    }
  }

  // ── overridable ──
  const clashes = input.otherVisits.filter(
    (o) => o.id !== visit.id && o.status !== "cancelled" && overlaps(visit, o),
  );
  if (clashes.length > 0) {
    overridable.push({ code: "OVERLAP", message: `Carer already has ${clashes.length} overlapping visit(s)` });
  }

  const blockedTime = input.unavailability.filter(
    (u) => start.getTime() < new Date(u.ends_at).getTime() && new Date(u.starts_at).getTime() < end.getTime(),
  );
  if (blockedTime.length > 0) {
    overridable.push({ code: "UNAVAILABLE", message: "Carer has marked themselves unavailable at this time" });
  }

  const missing = visit.required_skills.filter((s) => !carer.skills.includes(s));
  if (missing.length > 0) {
    overridable.push({ code: "MISSING_SKILL", message: `Carer lacks required skill(s): ${missing.join(", ")}` });
  }

  const petClash = carer.pet_allergies.filter((a) => client.pets.some((p) => p.trim().toLowerCase() === a.trim().toLowerCase()));
  if (petClash.length > 0) {
    overridable.push({ code: "PET_ALLERGY", message: `Carer is allergic to the client's pet(s): ${petClash.join(", ")}` });
  }

  if (carer.max_weekly_hours != null) {
    const week = weekKey(visit.start_time);
    const plannedMinutes = input.otherVisits
      .filter((o) => o.id !== visit.id && o.status !== "cancelled" && weekKey(o.start_time) === week)
      .reduce((sum, o) => sum + minutesBetween(o.start_time, o.end_time), 0);
    const total = plannedMinutes + minutesBetween(visit.start_time, visit.end_time);
    if (total > carer.max_weekly_hours * 60) {
      overridable.push({
        code: "OVER_WEEKLY_HOURS",
        message: `Would bring the carer to ${round1(total / 60)}h this week (max ${carer.max_weekly_hours}h)`,
      });
    }
  }

  // ── warnings ──
  const hours = parseWorkingHours(carer.availability);
  if (hours && !fitsWorkingHours(hours, start, end)) {
    warnings.push({ code: "OUTSIDE_WORKING_HOURS", message: "Visit is outside the carer's usual working hours" });
  }
  if (client.prefers_non_smoking_carer && carer.is_smoker) {
    warnings.push({ code: "PREFERS_NON_SMOKER", message: "Client prefers a non-smoking carer" });
  }

  return { blocked, overridable, warnings, preferred: input.preference === "preferred" };
}

/** Whether to go ahead: never when blocked; overridable issues need force. */
export function canAssign(e: Eligibility, force: boolean): boolean {
  return e.blocked.length === 0 && (force || e.overridable.length === 0);
}

// ── Working hours ────────────────────────────────────────────────────────────

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const WORKING_HOUR_DAYS = DAY_KEYS;

/** Windows per ISO weekday (1-7), in minutes from midnight. */
export type WorkingHours = Record<number, { start: number; end: number }[]>;

function toMinutes(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes <= 1440 ? minutes : null; // "24:00" is allowed as an end
}

/**
 * Parses carers.availability: {"mon":[{"start":"07:00","end":"14:00"}], ...} (London time).
 * Returns null when no pattern is recorded (empty / malformed), which means "unrestricted".
 */
export function parseWorkingHours(raw: unknown): WorkingHours | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: WorkingHours = {};
  let any = false;
  DAY_KEYS.forEach((key, i) => {
    const windows = (raw as Record<string, unknown>)[key];
    out[i + 1] = [];
    if (!Array.isArray(windows)) return;
    for (const w of windows) {
      if (!w || typeof w !== "object") continue;
      const s = toMinutes(String((w as { start?: unknown }).start));
      const e = toMinutes(String((w as { end?: unknown }).end));
      if (s !== null && e !== null && e > s) {
        out[i + 1].push({ start: s, end: e });
        any = true;
      }
    }
  });
  // A pattern with keys but no valid windows means "never works", not "unrestricted".
  const hasKeys = DAY_KEYS.some((k) => k in (raw as Record<string, unknown>));
  return any || hasKeys ? out : null;
}

function covers(windows: { start: number; end: number }[], start: number, end: number): boolean {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged.some((w) => w.start <= start && w.end >= end);
}

/** Is [start, end) inside the carer's windows? Visits past midnight are checked day by day. */
export function fitsWorkingHours(hours: WorkingHours, start: Date, end: Date): boolean {
  let cursor = start;
  while (cursor.getTime() < end.getTime()) {
    const dayStr = londonDateOf(cursor);
    const day = parseCalendarDate(dayStr);
    const nextMidnight = londonMidnight(addDays(day, 1));
    const segmentEnd = end.getTime() < nextMidnight.getTime() ? end : nextMidnight;
    const startParts = londonParts(cursor);
    const startMin = startParts.hour * 60 + startParts.minute;
    const endMin = segmentEnd.getTime() === nextMidnight.getTime()
      ? 1440
      : londonParts(segmentEnd).hour * 60 + londonParts(segmentEnd).minute;
    if (!covers(hours[isoWeekdayOf(day)] ?? [], startMin, endMin)) return false;
    cursor = segmentEnd;
  }
  return true;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function normaliseGender(value: string | null | undefined): "female" | "male" | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (["female", "f", "woman"].includes(v)) return "female";
  if (["male", "m", "man"].includes(v)) return "male";
  return null;
}

function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

/** Monday (London) of the week a visit starts in; the weekly-hours bucket. */
export function weekKey(startIso: string): string {
  const day = parseCalendarDate(londonDateOf(new Date(startIso)));
  return toDateString(addDays(day, 1 - isoWeekdayOf(day)));
}

const round1 = (n: number) => Math.round(n * 10) / 10;
