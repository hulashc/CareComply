import { describe, expect, it } from "vitest";
import {
  assignSchema,
  bulkSchema,
  carerAttributesSchema,
  clientPreferencesSchema,
  createVisitSchema,
  listVisitsQuerySchema,
  unavailabilitySchema,
  updateVisitSchema,
  workingHoursSchema,
} from "./schemas";

const client_id = "11111111-1111-4111-8111-111111111111";
const carer1 = "22222222-2222-4222-8222-222222222221";
const carer2 = "22222222-2222-4222-8222-222222222222";
const visit = { client_id, date: "2026-07-13", start_time: "08:00", end_time: "08:45" };
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe("createVisitSchema", () => {
  it("accepts a minimal visit and applies defaults (draft, one carer, no force)", () => {
    const r = createVisitSchema.parse(visit);
    expect(r).toMatchObject({ required_carers: 1, required_skills: [], roster_state: "draft", carer_ids: [], force: false });
  });

  it("accepts a recurring double-up with carers", () => {
    expect(ok(createVisitSchema, {
      ...visit, required_carers: 2, carer_ids: [carer1, carer2],
      recurrence: { frequency: "custom", by_weekday: [1, 3, 5], until_date: "2026-09-01" },
    })).toBe(true);
  });

  it("rejects malformed or impossible dates and times", () => {
    expect(ok(createVisitSchema, { ...visit, date: "2026-02-30" })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, date: "13/07/2026" })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, start_time: "8am" })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, start_time: "25:00" })).toBe(false);
  });

  it("rejects a zero-length visit but allows one past midnight", () => {
    expect(ok(createVisitSchema, { ...visit, end_time: "08:00" })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, start_time: "22:00", end_time: "06:00" })).toBe(true);
  });

  it("rejects more carers than required, duplicates, and more than two", () => {
    expect(ok(createVisitSchema, { ...visit, carer_ids: [carer1, carer2] })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, required_carers: 2, carer_ids: [carer1, carer1] })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, required_carers: 3 })).toBe(false);
  });

  it("validates the recurrence", () => {
    expect(ok(createVisitSchema, { ...visit, recurrence: { frequency: "custom" } })).toBe(false); // needs weekdays
    expect(ok(createVisitSchema, { ...visit, recurrence: { frequency: "weekly", until_date: "2026-07-01" } })).toBe(false); // before start
    expect(ok(createVisitSchema, { ...visit, recurrence: { frequency: "monthly" } })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, recurrence: { frequency: "daily", repeat_every: 0 } })).toBe(false);
  });

  it("rejects unknown fields and bad ids (strict)", () => {
    expect(ok(createVisitSchema, { ...visit, org_id: client_id })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, client_id: "nope" })).toBe(false);
    expect(ok(createVisitSchema, { ...visit, required_skills: ["Has Spaces"] })).toBe(false);
  });
});

describe("updateVisitSchema", () => {
  it("defaults to scope 'this' and needs at least one field", () => {
    expect(updateVisitSchema.parse({ notes: "x" }).scope).toBe("this");
    expect(ok(updateVisitSchema, {})).toBe(false);
    expect(ok(updateVisitSchema, { scope: "all" })).toBe(false);
  });

  it("restricts date and status to scope 'this', recurrence to following / all", () => {
    expect(ok(updateVisitSchema, { date: "2026-07-14" })).toBe(true);
    expect(ok(updateVisitSchema, { scope: "all", date: "2026-07-14" })).toBe(false);
    expect(ok(updateVisitSchema, { scope: "following", status: "cancelled" })).toBe(false);
    expect(ok(updateVisitSchema, { scope: "this", recurrence: { repeat_every: 2 } })).toBe(false);
    expect(ok(updateVisitSchema, { scope: "following", recurrence: { repeat_every: 2 } })).toBe(true);
    expect(ok(updateVisitSchema, { scope: "all", recurrence: {} })).toBe(false);
  });

  it("allows clearing nullable fields", () => {
    expect(ok(updateVisitSchema, { notes: null, location_id: null })).toBe(true);
  });
});

describe("assign / bulk / list", () => {
  it("assignSchema defaults", () => {
    expect(assignSchema.parse({ carer_id: carer1 })).toEqual({ carer_id: carer1, scope: "this", force: false });
    expect(ok(assignSchema, { carer_id: carer1, slot: 2 })).toBe(false); // slots are chosen by the server
  });

  it("bulkSchema needs exactly one of ids / filter and the action's own inputs", () => {
    const filter = { from: "2026-07-13", to: "2026-07-19" };
    expect(ok(bulkSchema, { action: "publish", ids: [carer1] })).toBe(true);
    expect(ok(bulkSchema, { action: "publish", filter })).toBe(true);
    expect(ok(bulkSchema, { action: "publish" })).toBe(false);
    expect(ok(bulkSchema, { action: "publish", ids: [carer1], filter })).toBe(false);
    expect(ok(bulkSchema, { action: "assign", ids: [carer1] })).toBe(false); // needs carer_id
    expect(ok(bulkSchema, { action: "assign", ids: [carer1], carer_id: carer2 })).toBe(true);
    expect(ok(bulkSchema, { action: "set_status", ids: [carer1] })).toBe(false);
    expect(ok(bulkSchema, { action: "update", ids: [carer1], changes: {} })).toBe(false);
    expect(ok(bulkSchema, { action: "update", ids: [carer1], changes: { notes: "x" } })).toBe(true);
    expect(ok(bulkSchema, { action: "explode", ids: [carer1] })).toBe(false);
  });

  it("bulkSchema caps targets at 500 and the filter range at 62 days", () => {
    const many = Array.from({ length: 501 }, (_, i) => `33333333-3333-4333-8333-${String(i).padStart(12, "0")}`);
    expect(ok(bulkSchema, { action: "publish", ids: many })).toBe(false);
    expect(ok(bulkSchema, { action: "publish", filter: { from: "2026-01-01", to: "2026-06-01" } })).toBe(false);
  });

  it("listVisitsQuerySchema coerces numbers, parses status lists and limits the range", () => {
    const r = listVisitsQuerySchema.parse({ from: "2026-07-13", to: "2026-07-19", status: "unassigned,assigned", limit: "50", unassigned: "true" });
    expect(r).toMatchObject({ status: ["unassigned", "assigned"], limit: 50, offset: 0, unassigned: true });
    expect(ok(listVisitsQuerySchema, { from: "2026-07-13", to: "2026-07-10" })).toBe(false);
    expect(ok(listVisitsQuerySchema, { from: "2026-07-01", to: "2026-09-30" })).toBe(false); // > 62 days
    expect(ok(listVisitsQuerySchema, { from: "2026-07-01", to: "2026-08-31" })).toBe(true); // exactly 62 days
    expect(ok(listVisitsQuerySchema, { from: "2026-07-13", to: "2026-07-19", status: "bogus" })).toBe(false);
    expect(ok(listVisitsQuerySchema, { from: "2026-07-13", to: "2026-07-19", limit: "9999" })).toBe(false);
  });
});

describe("availability", () => {
  it("workingHoursSchema accepts windows and 24:00, rejects reversed windows", () => {
    expect(ok(workingHoursSchema, { mon: [{ start: "07:00", end: "14:00" }], tue: [{ start: "20:00", end: "24:00" }] })).toBe(true);
    expect(ok(workingHoursSchema, {})).toBe(true); // clears the pattern
    expect(ok(workingHoursSchema, { mon: [{ start: "14:00", end: "07:00" }] })).toBe(false);
    expect(ok(workingHoursSchema, { funday: [] })).toBe(false);
  });

  it("unavailabilitySchema needs a positive span; overnight uses end_date", () => {
    expect(ok(unavailabilitySchema, { date: "2026-07-14", start_time: "14:00", end_time: "16:00" })).toBe(true);
    expect(ok(unavailabilitySchema, { date: "2026-07-14", start_time: "16:00", end_time: "14:00" })).toBe(false);
    expect(ok(unavailabilitySchema, { date: "2026-07-14", start_time: "22:00", end_date: "2026-07-15", end_time: "06:00" })).toBe(true);
    expect(ok(unavailabilitySchema, { date: "2026-07-14", start_time: "08:00", end_date: "2026-07-13", end_time: "09:00" })).toBe(false);
  });
});

describe("carer attributes and client preferences", () => {
  it("carerAttributesSchema validates ranges and requires lat/lng together", () => {
    expect(ok(carerAttributesSchema, { languages: ["English", "Urdu"], transport_mode: "car", max_weekly_hours: 40, skills: ["medication"] })).toBe(true);
    expect(ok(carerAttributesSchema, { transport_mode: "helicopter" })).toBe(false);
    expect(ok(carerAttributesSchema, { max_weekly_hours: 120 })).toBe(false);
    expect(ok(carerAttributesSchema, { lat: 52.63 })).toBe(false);
    expect(ok(carerAttributesSchema, { lat: 52.63, lng: -1.13 })).toBe(true);
    expect(ok(carerAttributesSchema, { lat: 152, lng: 0 })).toBe(false);
    expect(ok(carerAttributesSchema, {})).toBe(false);
  });

  it("clientPreferencesSchema keeps preferred and excluded carers apart", () => {
    expect(ok(clientPreferencesSchema, { preferred_carers: [{ carer_id: carer1 }], excluded_carers: [{ carer_id: carer2, reason: "Past complaint" }] })).toBe(true);
    expect(ok(clientPreferencesSchema, { preferred_carers: [{ carer_id: carer1 }], excluded_carers: [{ carer_id: carer1 }] })).toBe(false);
    expect(ok(clientPreferencesSchema, { excluded_carers: [{ carer_id: carer1 }, { carer_id: carer1 }] })).toBe(false);
  });

  it("clientPreferencesSchema: a required gender needs a preferred gender", () => {
    expect(ok(clientPreferencesSchema, { preferred_carer_gender: "female", carer_gender_required: true })).toBe(true);
    expect(ok(clientPreferencesSchema, { preferred_carer_gender: null, carer_gender_required: true })).toBe(false);
    expect(ok(clientPreferencesSchema, { preferred_carer_gender: "other" })).toBe(false);
    expect(ok(clientPreferencesSchema, { pets: ["dog"], prefers_non_smoking_carer: true, primary_language: "Gujarati" })).toBe(true);
  });
});
