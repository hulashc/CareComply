import { describe, expect, it } from "vitest";
import type { VisitRow } from "../roster/types";
import { carerConflicts, detectConflicts, hasBlocking } from "./conflicts";
import type { RosterCarer } from "./types";

const carer = (over: Partial<RosterCarer> = {}): RosterCarer => ({
  carer_id: "c1",
  full_name: "Ann",
  status: "active",
  is_available: true,
  working_hours: {},
  max_weekly_hours: null,
  contract_hours: null,
  location_id: null,
  team: null,
  skills: [],
  gender: null,
  absences: [],
  unavailability: [],
  ...over,
});

let n = 0;
const visit = (start: string, end: string, over: Partial<VisitRow> = {}): VisitRow => ({
  id: `v${++n}`,
  org_id: "o",
  client_id: "cl",
  client_name: "Client",
  location_id: null,
  start_time: start,
  end_time: end,
  status: "assigned",
  roster_state: "draft",
  published_at: null,
  required_carers: 1,
  required_skills: [],
  notes: null,
  series_id: null,
  occurrence_date: null,
  is_series_exception: false,
  actual_start: null,
  actual_end: null,
  created_at: "",
  updated_at: "",
  carers: [{ carer_id: "c1", full_name: "Ann", slot: 1 }],
  open_slots: 0,
  ...over,
});

// 2026-03-02 is a Monday, in GMT (London == UTC).
const at = (hhmm: string, day = "2026-03-02") => `${day}T${hhmm}:00.000Z`;
const codes = (m: Map<string, { code: string }[]>, id: string) => (m.get(id) ?? []).map((c) => c.code);

describe("double booking", () => {
  it("flags both visits when a carer's visits overlap", () => {
    const a = visit(at("09:00"), at("10:00"));
    const b = visit(at("09:30"), at("10:30"));
    const m = detectConflicts([a, b], [carer()]);
    expect(codes(m, a.id)).toContain("DOUBLE_BOOKED");
    expect(codes(m, b.id)).toContain("DOUBLE_BOOKED");
  });

  it("does not flag visits that merely touch", () => {
    const a = visit(at("09:00"), at("10:00"));
    const b = visit(at("10:00"), at("11:00"));
    expect(detectConflicts([a, b], [carer()]).size).toBe(0);
  });

  it("ignores cancelled visits on either side", () => {
    const a = visit(at("09:00"), at("10:00"));
    const b = visit(at("09:30"), at("10:30"), { status: "cancelled" });
    expect(detectConflicts([a, b], [carer()]).size).toBe(0);
  });

  it("does not flag two different carers on overlapping visits", () => {
    const a = visit(at("09:00"), at("10:00"));
    const b = visit(at("09:00"), at("10:00"), { carers: [{ carer_id: "c2", full_name: "Bob", slot: 1 }] });
    expect(detectConflicts([a, b], [carer(), carer({ carer_id: "c2", full_name: "Bob" })]).size).toBe(0);
  });

  it("counts a double-up visit against each of its carers", () => {
    const dbl = visit(at("09:00"), at("10:00"), {
      required_carers: 2,
      carers: [{ carer_id: "c1", full_name: "Ann", slot: 1 }, { carer_id: "c2", full_name: "Bob", slot: 2 }],
    });
    const other = visit(at("09:15"), at("09:45"), { carers: [{ carer_id: "c2", full_name: "Bob", slot: 1 }] });
    const m = detectConflicts([dbl, other], [carer(), carer({ carer_id: "c2", full_name: "Bob" })]);
    expect(codes(m, dbl.id)).toEqual(["DOUBLE_BOOKED"]);
    expect(m.get(dbl.id)?.[0].carer_id).toBe("c2");
  });
});

describe("availability", () => {
  const nineToFive = { mon: [{ start: "09:00", end: "17:00" }] };

  it("flags a visit outside working hours, not one inside", () => {
    const c = carer({ working_hours: nineToFive });
    const early = visit(at("07:00"), at("08:00"));
    const ok = visit(at("10:00"), at("11:00"));
    const m = detectConflicts([early, ok], [c]);
    expect(codes(m, early.id)).toContain("OUTSIDE_HOURS");
    expect(m.has(ok.id)).toBe(false);
  });

  it("flags a day the carer does not work at all", () => {
    const c = carer({ working_hours: nineToFive });
    const tue = visit(at("10:00", "2026-03-03"), at("11:00", "2026-03-03"));
    expect(codes(detectConflicts([tue], [c]), tue.id)).toContain("OUTSIDE_HOURS");
  });

  it("treats an empty pattern as unrestricted", () => {
    expect(detectConflicts([visit(at("03:00"), at("04:00"))], [carer({ working_hours: {} })]).size).toBe(0);
  });

  it("flags part-day unavailability that overlaps", () => {
    const c = carer({ unavailability: [{ id: "u", starts_at: at("09:30"), ends_at: at("12:00"), reason: "dentist" }] });
    const v = visit(at("09:00"), at("10:00"));
    expect(codes(detectConflicts([v], [c]), v.id)).toContain("UNAVAILABLE");
  });

  it("does not flag unavailability that ends exactly when the visit starts", () => {
    const c = carer({ unavailability: [{ id: "u", starts_at: at("08:00"), ends_at: at("09:00"), reason: null }] });
    expect(detectConflicts([visit(at("09:00"), at("10:00"))], [c]).size).toBe(0);
  });
});

describe("leave", () => {
  const leave = (status: string) => ({ id: "a", absence_type: "annual_leave", start_date: "2026-03-02", end_date: "2026-03-03", status, reason: null });

  it("approved leave is a blocking conflict", () => {
    const v = visit(at("09:00"), at("10:00"));
    const m = detectConflicts([v], [carer({ absences: [leave("approved")] })]);
    expect(codes(m, v.id)).toEqual(["ON_LEAVE"]);
    expect(hasBlocking(m.get(v.id))).toBe(true);
  });

  it("pending leave is a warning, not blocking", () => {
    const v = visit(at("09:00"), at("10:00"));
    const m = detectConflicts([v], [carer({ absences: [leave("pending")] })]);
    expect(codes(m, v.id)).toEqual(["LEAVE_PENDING"]);
    expect(hasBlocking(m.get(v.id))).toBe(false);
  });

  it("does not flag a visit the day after leave ends", () => {
    const v = visit(at("09:00", "2026-03-04"), at("10:00", "2026-03-04"));
    expect(detectConflicts([v], [carer({ absences: [leave("approved")] })]).size).toBe(0);
  });

  it("covers the whole London day in summer time (BST)", () => {
    // 2026-07-01 00:30 London is 2026-06-30 23:30 UTC; leave on 1 July must still cover it.
    const c = carer({ absences: [{ id: "a", absence_type: "sickness", start_date: "2026-07-01", end_date: "2026-07-01", status: "approved", reason: null }] });
    const v = visit("2026-06-30T23:30:00.000Z", "2026-07-01T00:30:00.000Z");
    expect(codes(detectConflicts([v], [c]), v.id)).toContain("ON_LEAVE");
  });
});

describe("staffing and hours", () => {
  it("flags a double-up visit with only one carer", () => {
    const v = visit(at("09:00"), at("10:00"), { required_carers: 2, open_slots: 1 });
    expect(codes(detectConflicts([v], [carer()]), v.id)).toContain("UNDERSTAFFED");
  });

  it("does not flag an unassigned visit as understaffed (the tray covers it)", () => {
    const v = visit(at("09:00"), at("10:00"), { status: "unassigned", carers: [], open_slots: 1 });
    expect(detectConflicts([v], [carer()]).size).toBe(0);
  });

  it("flags going over max weekly hours", () => {
    const c = carer({ max_weekly_hours: 3 });
    const vs = [visit(at("08:00"), at("10:00")), visit(at("12:00"), at("14:00"))];
    expect(codes(detectConflicts(vs, [c]), vs[1].id)).toContain("OVER_WEEKLY_HOURS");
  });

  it("does not count other weeks towards the weekly total", () => {
    const c = carer({ max_weekly_hours: 3 });
    const vs = [visit(at("08:00"), at("10:00")), visit(at("12:00", "2026-03-09"), at("14:00", "2026-03-09"))];
    expect(detectConflicts(vs, [c]).size).toBe(0);
  });
});

describe("carerConflicts (live drag preview)", () => {
  it("evaluates a hypothetical placement against the carer's other visits", () => {
    const other = visit(at("09:00"), at("10:00"));
    const dragged = visit(at("09:30"), at("10:30"), { carers: [] });
    expect(carerConflicts(dragged, carer(), [other]).map((c) => c.code)).toContain("DOUBLE_BOOKED");
  });

  it("returns nothing for an unknown carer or a cancelled visit", () => {
    const v = visit(at("09:00"), at("10:00"), { status: "cancelled" });
    expect(carerConflicts(v, carer(), [])).toEqual([]);
    expect(carerConflicts(visit(at("09:00"), at("10:00")), undefined, [])).toEqual([]);
  });
});
