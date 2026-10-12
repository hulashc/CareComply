import { z } from "zod";
import { dayNumber, parseCalendarDate } from "../dates/london";
import { durationBetween } from "./recurrence";
import { WEIGHT_KEYS } from "./weights";
import {
  MAX_BULK_TARGETS,
  MAX_CARERS_PER_VISIT,
  MAX_RANGE_DAYS,
  ROSTER_STATES,
  SCOPES,
  SERIES_FREQUENCIES,
  TRANSPORT_MODES,
  VISIT_STATUSES,
} from "./types";

// Request schemas for /api/roster/*. Bodies are snake_case (matching the existing API). Dates and
// times are London calendar dates and wall-clock times, never naive ISO strings, so a request
// means the same thing whatever timezone the server runs in.

const uuid = z.uuid();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => {
    try {
      parseCalendarDate(v);
      return true;
    } catch {
      return false;
    }
  }, "Not a real calendar date");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour)");
const skillCode = z.string().regex(/^[a-z0-9_]{2,40}$/, "Skill codes are 2-40 chars of a-z, 0-9 and _");
const note = z.string().max(1000);
const carerCount = z.union([z.literal(1), z.literal(2)]);
const weekdays = z.array(z.number().int().min(1).max(7)).max(7);

const dedupe = <T>(arr: T[]) => new Set(arr).size === arr.length;
const dayDiff = (a: string, b: string) => dayNumber(parseCalendarDate(b)) - dayNumber(parseCalendarDate(a));

// ── Recurrence ───────────────────────────────────────────────────────────────

export const recurrenceSchema = z
  .strictObject({
    frequency: z.enum(SERIES_FREQUENCIES),
    repeat_every: z.number().int().min(1).max(52).default(1),
    by_weekday: weekdays.default([]),
    until_date: dateStr.nullable().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.frequency === "custom" && r.by_weekday.length === 0) {
      ctx.addIssue({ code: "custom", path: ["by_weekday"], message: "A custom recurrence needs at least one weekday" });
    }
    if (!dedupe(r.by_weekday)) ctx.addIssue({ code: "custom", path: ["by_weekday"], message: "Weekdays must be unique" });
  });

export const recurrencePatchSchema = z
  .strictObject({
    frequency: z.enum(SERIES_FREQUENCIES).optional(),
    repeat_every: z.number().int().min(1).max(52).optional(),
    by_weekday: weekdays.optional(),
    until_date: dateStr.nullable().optional(),
  })
  .refine((r) => Object.keys(r).length > 0, "Provide at least one recurrence field");

// ── Visits ───────────────────────────────────────────────────────────────────

export const createVisitSchema = z
  .strictObject({
    client_id: uuid,
    location_id: uuid.nullable().optional(),
    date: dateStr,
    start_time: timeStr,
    end_time: timeStr,
    required_carers: carerCount.default(1),
    required_skills: z.array(skillCode).max(20).default([]),
    notes: note.nullable().optional(),
    roster_state: z.enum(ROSTER_STATES).default("draft"),
    carer_ids: z.array(uuid).max(MAX_CARERS_PER_VISIT).default([]),
    recurrence: recurrenceSchema.nullable().optional(),
    /** Assign despite overridable issues (overlap, missing skill, ...). Audited. */
    force: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (durationBetween(v.start_time, v.end_time) === 0) {
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "End time must differ from start time" });
    }
    if (v.carer_ids.length > v.required_carers) {
      ctx.addIssue({ code: "custom", path: ["carer_ids"], message: "More carers than the visit requires" });
    }
    if (!dedupe(v.carer_ids)) ctx.addIssue({ code: "custom", path: ["carer_ids"], message: "Carers must be unique" });
    if (v.recurrence?.until_date && dayDiff(v.date, v.recurrence.until_date) < 0) {
      ctx.addIssue({ code: "custom", path: ["recurrence", "until_date"], message: "End date is before the first visit" });
    }
  });
export type CreateVisitBody = z.infer<typeof createVisitSchema>;

const editableFields = {
  date: dateStr.optional(),
  start_time: timeStr.optional(),
  end_time: timeStr.optional(),
  location_id: uuid.nullable().optional(),
  required_carers: carerCount.optional(),
  required_skills: z.array(skillCode).max(20).optional(),
  notes: note.nullable().optional(),
  roster_state: z.enum(ROSTER_STATES).optional(),
  status: z.enum(VISIT_STATUSES).optional(),
  recurrence: recurrencePatchSchema.optional(),
};

export const updateVisitSchema = z
  .strictObject({ scope: z.enum(SCOPES).default("this"), ...editableFields })
  .superRefine((v, ctx) => {
    const { scope, ...fields } = v;
    if (Object.values(fields).every((x) => x === undefined)) {
      ctx.addIssue({ code: "custom", message: "Provide at least one field to change" });
    }
    if (v.date && scope !== "this") {
      ctx.addIssue({ code: "custom", path: ["date"], message: "Moving a visit to another date needs scope 'this'" });
    }
    if (v.status && scope !== "this") {
      ctx.addIssue({ code: "custom", path: ["status"], message: "A status change needs scope 'this'" });
    }
    if (v.recurrence && scope === "this") {
      ctx.addIssue({ code: "custom", path: ["recurrence"], message: "A recurrence change needs scope 'following' or 'all'" });
    }
  });
export type UpdateVisitBody = z.infer<typeof updateVisitSchema>;

export const deleteVisitQuerySchema = z.strictObject({ scope: z.enum(SCOPES).default("this") });

// The lowest free slot is used (lead first), so callers never manage slot numbers.
export const assignSchema = z.strictObject({
  carer_id: uuid,
  scope: z.enum(SCOPES).default("this"),
  force: z.boolean().default(false),
});

// ── List / filter ────────────────────────────────────────────────────────────

/** "a,b,c" -> ["a","b","c"], validated as a list of visit statuses. */
const statusList = z
  .string()
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
  .pipe(z.array(z.enum(VISIT_STATUSES)).min(1).max(6));

const filterFields = {
  client_id: uuid.optional(),
  carer_id: uuid.optional(),
  location_id: uuid.optional(),
  series_id: uuid.optional(),
  roster_state: z.enum(ROSTER_STATES).optional(),
  skill: skillCode.optional(),
};

export const listVisitsQuerySchema = z
  .strictObject({
    from: dateStr,
    to: dateStr,
    status: statusList.optional(),
    /** unassigned=true narrows to visits that still need carers (including half-staffed double-ups). */
    unassigned: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
    ...filterFields,
  })
  .superRefine((q, ctx) => {
    const days = dayDiff(q.from, q.to);
    if (days < 0) ctx.addIssue({ code: "custom", path: ["to"], message: "'to' is before 'from'" });
    else if (days + 1 > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `Range is limited to ${MAX_RANGE_DAYS} days` });
    }
  });
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;

export const rangeQuerySchema = z
  .strictObject({ from: dateStr, to: dateStr })
  .superRefine((q, ctx) => {
    const days = dayDiff(q.from, q.to);
    if (days < 0) ctx.addIssue({ code: "custom", path: ["to"], message: "'to' is before 'from'" });
    else if (days + 1 > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `Range is limited to ${MAX_RANGE_DAYS} days` });
    }
  });

/**
 * GET /api/roster/visits/[id]/suggestions?limit=3
 * `all=1` returns a compact score for every carer instead (the drag heat map), optionally for a
 * hypothetical `start`/`end` and with `from_carer` treated as removed from the visit.
 */
export const suggestionsQuerySchema = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(10).default(3),
    all: z.enum(["0", "1", "true", "false"]).optional().transform((v) => v === "1" || v === "true"),
    start: z.iso.datetime({ offset: true }).optional(),
    end: z.iso.datetime({ offset: true }).optional(),
    from_carer: uuid.optional(),
  })
  .superRefine((q, ctx) => {
    if ((q.start === undefined) !== (q.end === undefined)) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "'start' and 'end' go together" });
    } else if (q.start && q.end) {
      const ms = Date.parse(q.end) - Date.parse(q.start);
      if (ms <= 0) ctx.addIssue({ code: "custom", path: ["end"], message: "'end' must be after 'start'" });
      else if (ms > 24 * 3_600_000) ctx.addIssue({ code: "custom", path: ["end"], message: "A visit is limited to 24 hours" });
    }
  });

// ── Bulk ─────────────────────────────────────────────────────────────────────

export const bulkFilterSchema = z
  .strictObject({
    from: dateStr,
    to: dateStr,
    status: z.array(z.enum(VISIT_STATUSES)).max(6).optional(),
    ...filterFields,
  })
  .superRefine((f, ctx) => {
    const days = dayDiff(f.from, f.to);
    if (days < 0) ctx.addIssue({ code: "custom", path: ["to"], message: "'to' is before 'from'" });
    else if (days + 1 > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `Range is limited to ${MAX_RANGE_DAYS} days` });
    }
  });
export type BulkFilter = z.infer<typeof bulkFilterSchema>;

export const BULK_ACTIONS = ["assign", "unassign", "set_status", "publish", "unpublish", "update", "delete"] as const;

export const bulkSchema = z
  .strictObject({
    action: z.enum(BULK_ACTIONS),
    ids: z.array(uuid).min(1).max(MAX_BULK_TARGETS).optional(),
    filter: bulkFilterSchema.optional(),
    carer_id: uuid.optional(),
    status: z.enum(VISIT_STATUSES).optional(),
    changes: z
      .strictObject({
        notes: note.nullable().optional(),
        location_id: uuid.nullable().optional(),
        required_skills: z.array(skillCode).max(20).optional(),
        required_carers: carerCount.optional(),
        roster_state: z.enum(ROSTER_STATES).optional(),
      })
      .optional(),
    force: z.boolean().default(false),
    /** Report what would happen without changing anything. */
    dry_run: z.boolean().default(false),
  })
  .superRefine((b, ctx) => {
    if (!!b.ids === !!b.filter) {
      ctx.addIssue({ code: "custom", message: "Provide exactly one of 'ids' or 'filter'" });
    }
    if ((b.action === "assign" || b.action === "unassign") && !b.carer_id) {
      ctx.addIssue({ code: "custom", path: ["carer_id"], message: "carer_id is required" });
    }
    if (b.action === "set_status" && !b.status) ctx.addIssue({ code: "custom", path: ["status"], message: "status is required" });
    if (b.action === "update" && (!b.changes || Object.keys(b.changes).length === 0)) {
      ctx.addIssue({ code: "custom", path: ["changes"], message: "changes is required" });
    }
  });
export type BulkBody = z.infer<typeof bulkSchema>;

// ── Carer availability ───────────────────────────────────────────────────────

const windowEnd = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Use HH:mm, or 24:00 for midnight");
const hoursWindow = z
  .strictObject({ start: timeStr, end: windowEnd })
  .refine((w) => w.start < w.end, "Window must end after it starts");
const dayWindows = z.array(hoursWindow).max(6);

/** Weekly working hours (London). An empty object clears the pattern (= unrestricted). */
export const workingHoursSchema = z.strictObject({
  mon: dayWindows.optional(),
  tue: dayWindows.optional(),
  wed: dayWindows.optional(),
  thu: dayWindows.optional(),
  fri: dayWindows.optional(),
  sat: dayWindows.optional(),
  sun: dayWindows.optional(),
});

/** A part-day block entered as London wall-clock time; multi-day blocks use end_date. */
export const unavailabilitySchema = z
  .strictObject({
    date: dateStr,
    start_time: timeStr,
    end_date: dateStr.optional(),
    end_time: timeStr,
    reason: z.string().max(300).nullable().optional(),
  })
  .superRefine((b, ctx) => {
    const endDate = b.end_date ?? b.date;
    if (dayDiff(b.date, endDate) < 0) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "End date is before the start date" });
    } else if (endDate === b.date && b.end_time <= b.start_time) {
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "End time must be after the start time (use end_date for overnight blocks)" });
    }
  });

// ── Carer attributes / client preferences ────────────────────────────────────

const language = z.string().trim().min(2).max(40);
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const tag = z.string().trim().min(1).max(40);

export const carerAttributesSchema = z
  .strictObject({
    skills: z.array(skillCode).max(40).optional(),
    languages: z.array(language).max(10).optional(),
    gender: z.string().trim().min(1).max(30).nullable().optional(),
    transport_mode: z.enum(TRANSPORT_MODES).nullable().optional(),
    max_weekly_hours: z.number().min(0).max(80).nullable().optional(),
    lat: lat.nullable().optional(),
    lng: lng.nullable().optional(),
    is_smoker: z.boolean().optional(),
    pet_allergies: z.array(tag).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field")
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), "Provide lat and lng together");
export type CarerAttributesBody = z.infer<typeof carerAttributesSchema>;

const carerRef = z.strictObject({ carer_id: uuid, reason: z.string().max(300).nullable().optional() });

export const clientPreferencesSchema = z
  .strictObject({
    gender: z.string().trim().min(1).max(30).nullable().optional(),
    primary_language: language.nullable().optional(),
    preferred_carer_gender: z.enum(["female", "male"]).nullable().optional(),
    carer_gender_required: z.boolean().optional(),
    prefers_non_smoking_carer: z.boolean().optional(),
    pets: z.array(tag).max(10).optional(),
    allergies: z.array(tag).max(30).optional(),
    lat: lat.nullable().optional(),
    lng: lng.nullable().optional(),
    /** Replaces the whole list when present. */
    preferred_carers: z.array(carerRef).max(20).optional(),
    /** The do-not-pair list; replaces the whole list when present. */
    excluded_carers: z.array(carerRef).max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field")
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), "Provide lat and lng together")
  .superRefine((v, ctx) => {
    const preferred = (v.preferred_carers ?? []).map((c) => c.carer_id);
    const excluded = (v.excluded_carers ?? []).map((c) => c.carer_id);
    if (!dedupe(preferred) || !dedupe(excluded)) ctx.addIssue({ code: "custom", message: "A carer can appear only once per list" });
    if (preferred.some((id) => excluded.includes(id))) {
      ctx.addIssue({ code: "custom", message: "A carer cannot be both preferred and excluded" });
    }
    if (v.carer_gender_required === true && v.preferred_carer_gender === null) {
      ctx.addIssue({ code: "custom", path: ["carer_gender_required"], message: "Set preferred_carer_gender to require a gender" });
    }
  });
export type ClientPreferencesBody = z.infer<typeof clientPreferencesSchema>;

// ── Skills / settings ────────────────────────────────────────────────────────

export const createSkillSchema = z.strictObject({ code: skillCode, name: z.string().trim().min(1).max(80) });
export const updateSkillSchema = z
  .strictObject({ name: z.string().trim().min(1).max(80).optional(), is_active: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");

const weightValue = z.number().min(0).max(100);
export const settingsSchema = z
  .strictObject({
    /** Partial: only the weights you send change. */
    weights: z.strictObject(Object.fromEntries(WEIGHT_KEYS.map((k) => [k, weightValue.optional()]))).optional(),
    /** Discard all overrides and return to the defaults. */
    reset: z.boolean().optional(),
  })
  .refine((v) => v.reset === true || (v.weights !== undefined && Object.keys(v.weights).length > 0), "Provide weights or reset");


// ── Batch edit (calendar drag/drop, undo/redo) ───────────────────────────────

const instant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Not a valid date-time");

/** The editable state of one visit. `updated_at` is the version the client last saw (absent for a new visit). */
export const visitSnapSchema = z
  .strictObject({
    id: uuid,
    client_id: uuid,
    location_id: uuid.nullable().optional(),
    start_time: instant,
    end_time: instant,
    required_carers: carerCount,
    required_skills: z.array(skillCode).max(20).default([]),
    notes: note.nullable().optional(),
    roster_state: z.enum(ROSTER_STATES).default("draft"),
    carer_ids: z.array(uuid).max(MAX_CARERS_PER_VISIT).default([]),
    series_id: uuid.nullable().optional(),
    occurrence_date: dateStr.nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (Date.parse(v.end_time) <= Date.parse(v.start_time)) ctx.addIssue({ code: "custom", path: ["end_time"], message: "End must be after start" });
    if (v.carer_ids.length > v.required_carers) ctx.addIssue({ code: "custom", path: ["carer_ids"], message: "More carers than the visit requires" });
    if (!dedupe(v.carer_ids)) ctx.addIssue({ code: "custom", path: ["carer_ids"], message: "Carers must be unique" });
  });
export type VisitSnapBody = z.infer<typeof visitSnapSchema>;

export const batchSchema = z
  .strictObject({
    upserts: z.array(visitSnapSchema).max(MAX_BULK_TARGETS).default([]),
    deletes: z.array(z.strictObject({ id: uuid, updated_at: z.string().nullable().optional() })).max(MAX_BULK_TARGETS).default([]),
    /** Go ahead despite overridable issues. Needs a reason; blocked issues can never be forced. */
    force: z.boolean().default(false),
    reason: z.string().trim().min(3).max(300).optional(),
    label: z.string().max(80).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.upserts.length + b.deletes.length === 0) ctx.addIssue({ code: "custom", message: "Nothing to change" });
    if (b.force && !b.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "A reason is required to override" });
    const all = [...b.upserts.map((u) => u.id), ...b.deletes.map((d) => d.id)];
    if (!dedupe(all)) ctx.addIssue({ code: "custom", message: "A visit appears more than once" });
  });
export type BatchBody = z.infer<typeof batchSchema>;
