import { describe, expect, it } from "vitest";
import {
  canAssign,
  checkEligibility,
  fitsWorkingHours,
  parseWorkingHours,
  weekKey,
  type EligibilityInput,
} from "./eligibility";

// Visit: Tuesday 14 July 2026, 09:00-10:00 London (08:00-09:00Z, BST).
const visit = { id: "v1", start_time: "2026-07-14T08:00:00Z", end_time: "2026-07-14T09:00:00Z", required_skills: [] as string[] };

function input(over: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    carer: {
      id: "c1", status: "active", is_available: true, gender: "female", skills: ["medication", "hoist"],
      pet_allergies: [], is_smoker: false, max_weekly_hours: null, availability: {},
    },
    client: { preferred_carer_gender: null, carer_gender_required: false, prefers_non_smoking_carer: false, pets: [] },
    visit,
    preference: null,
    absences: [],
    unavailability: [],
    otherVisits: [],
    ...over,
  };
}
const codes = (list: { code: string }[]) => list.map((i) => i.code);

describe("checkEligibility: a clean match", () => {
  it("has no issues and can be assigned without force", () => {
    const e = checkEligibility(input());
    expect(e).toEqual({ blocked: [], overridable: [], warnings: [], preferred: false });
    expect(canAssign(e, false)).toBe(true);
  });

  it("flags a preferred carer", () => {
    expect(checkEligibility(input({ preference: "preferred" })).preferred).toBe(true);
  });
});

describe("blocked (never allowed, even with force)", () => {
  it("do-not-pair list", () => {
    const e = checkEligibility(input({ preference: "excluded" }));
    expect(codes(e.blocked)).toEqual(["EXCLUDED_CARER"]);
    expect(canAssign(e, true)).toBe(false);
  });

  it("inactive or unavailable carer", () => {
    expect(codes(checkEligibility(input({ carer: { ...input().carer, status: "inactive" } })).blocked)).toEqual(["CARER_INACTIVE"]);
    expect(codes(checkEligibility(input({ carer: { ...input().carer, is_available: false } })).blocked)).toEqual(["CARER_INACTIVE"]);
    expect(codes(checkEligibility(input({ carer: { ...input().carer, status: null } })).blocked)).toEqual([]);
  });

  it("approved leave or sick days that cover the visit date", () => {
    const sick = { absence_type: "sick_leave", start_date: "2026-07-13", end_date: "2026-07-14", status: "approved" };
    const e = checkEligibility(input({ absences: [sick] }));
    expect(codes(e.blocked)).toEqual(["ON_LEAVE"]);
    expect(canAssign(e, true)).toBe(false);
  });

  it("leave on other days, or rejected leave, does not block", () => {
    const other = { absence_type: "holiday", start_date: "2026-07-20", end_date: "2026-07-25", status: "approved" };
    const rejected = { absence_type: "holiday", start_date: "2026-07-14", end_date: "2026-07-14", status: "rejected" };
    expect(checkEligibility(input({ absences: [other, rejected] })).blocked).toEqual([]);
  });

  it("a visit ending exactly at midnight does not touch the next day's leave", () => {
    const late = { ...visit, start_time: "2026-07-14T21:00:00Z", end_time: "2026-07-14T23:00:00Z" }; // 22:00 - 00:00 BST
    const leaveNextDay = { absence_type: "holiday", start_date: "2026-07-15", end_date: "2026-07-15", status: "approved" };
    expect(checkEligibility(input({ visit: late, absences: [leaveNextDay] })).blocked).toEqual([]);
  });

  it("a required carer gender", () => {
    const client = { ...input().client, preferred_carer_gender: "male", carer_gender_required: true };
    expect(codes(checkEligibility(input({ client })).blocked)).toEqual(["GENDER_REQUIRED"]);
    expect(checkEligibility(input({ client, carer: { ...input().carer, gender: "Male" } })).blocked).toEqual([]);
    // gender not recorded cannot satisfy a strict requirement
    expect(codes(checkEligibility(input({ client, carer: { ...input().carer, gender: null } })).blocked)).toEqual(["GENDER_REQUIRED"]);
  });
});

describe("overridable (needs force=true)", () => {
  it("overlapping visit, but back-to-back is fine and cancelled is ignored", () => {
    const clash = { id: "v2", start_time: "2026-07-14T08:30:00Z", end_time: "2026-07-14T09:30:00Z", status: "assigned" };
    const adjacent = { id: "v3", start_time: "2026-07-14T09:00:00Z", end_time: "2026-07-14T10:00:00Z", status: "assigned" };
    const cancelled = { ...clash, id: "v4", status: "cancelled" };
    const e = checkEligibility(input({ otherVisits: [clash] }));
    expect(codes(e.overridable)).toEqual(["OVERLAP"]);
    expect(canAssign(e, false)).toBe(false);
    expect(canAssign(e, true)).toBe(true);
    expect(checkEligibility(input({ otherVisits: [adjacent, cancelled] })).overridable).toEqual([]);
  });

  it("ignores the visit itself when re-checking an existing assignment", () => {
    const same = { id: "v1", start_time: visit.start_time, end_time: visit.end_time, status: "assigned" };
    expect(checkEligibility(input({ otherVisits: [same] })).overridable).toEqual([]);
  });

  it("an unavailability block", () => {
    const block = { starts_at: "2026-07-14T08:30:00Z", ends_at: "2026-07-14T12:00:00Z" };
    expect(codes(checkEligibility(input({ unavailability: [block] })).overridable)).toEqual(["UNAVAILABLE"]);
    const after = { starts_at: "2026-07-14T09:00:00Z", ends_at: "2026-07-14T12:00:00Z" }; // starts as the visit ends
    expect(checkEligibility(input({ unavailability: [after] })).overridable).toEqual([]);
  });

  it("missing required skills, naming them", () => {
    const e = checkEligibility(input({ visit: { ...visit, required_skills: ["hoist", "peg_feeding", "catheter_care"] } }));
    expect(codes(e.overridable)).toEqual(["MISSING_SKILL"]);
    expect(e.overridable[0].message).toContain("peg_feeding, catheter_care");
  });

  it("carer allergic to a client's pet (case-insensitive)", () => {
    const e = checkEligibility(input({
      carer: { ...input().carer, pet_allergies: ["Cat"] },
      client: { ...input().client, pets: ["cat", "dog"] },
    }));
    expect(codes(e.overridable)).toEqual(["PET_ALLERGY"]);
  });

  it("over the weekly hours limit, counting only the same London week", () => {
    const carer = { ...input().carer, max_weekly_hours: 3 };
    const mk = (id: string, start: string, end: string) => ({ id, start_time: start, end_time: end, status: "assigned" });
    const sameWeek = [mk("a", "2026-07-13T08:00:00Z", "2026-07-13T10:00:00Z"), mk("b", "2026-07-15T08:00:00Z", "2026-07-15T09:00:00Z")]; // 2h + 1h
    expect(codes(checkEligibility(input({ carer, otherVisits: sameWeek })).overridable)).toEqual(["OVER_WEEKLY_HOURS"]);
    // 2h + this 1h = 3h: exactly at the limit is fine
    expect(checkEligibility(input({ carer, otherVisits: [sameWeek[0]] })).overridable).toEqual([]);
    // visits in another week are ignored
    const otherWeek = [mk("c", "2026-07-20T08:00:00Z", "2026-07-20T12:00:00Z")];
    expect(checkEligibility(input({ carer, otherVisits: otherWeek })).overridable).toEqual([]);
  });
});

describe("warnings (allowed)", () => {
  it("soft gender preference, smoker preference, pending leave", () => {
    const e = checkEligibility(input({
      client: { ...input().client, preferred_carer_gender: "male", prefers_non_smoking_carer: true },
      carer: { ...input().carer, is_smoker: true },
      absences: [{ absence_type: "holiday", start_date: "2026-07-14", end_date: "2026-07-14", status: "pending" }],
    }));
    expect(e.blocked).toEqual([]);
    expect(codes(e.warnings).sort()).toEqual(["GENDER_PREFERENCE", "LEAVE_PENDING", "PREFERS_NON_SMOKER"]);
    expect(canAssign(e, false)).toBe(true);
  });

  it("outside working hours", () => {
    const availability = { tue: [{ start: "12:00", end: "18:00" }] };
    expect(codes(checkEligibility(input({ carer: { ...input().carer, availability } })).warnings)).toEqual(["OUTSIDE_WORKING_HOURS"]);
    const inside = { tue: [{ start: "07:00", end: "14:00" }] };
    expect(checkEligibility(input({ carer: { ...input().carer, availability: inside } })).warnings).toEqual([]);
  });
});

describe("working hours", () => {
  it("an empty or missing pattern is unrestricted", () => {
    expect(parseWorkingHours({})).toBeNull();
    expect(parseWorkingHours(null)).toBeNull();
    expect(parseWorkingHours([])).toBeNull();
  });

  it("a pattern with days but no windows means never available", () => {
    const hours = parseWorkingHours({ mon: [], tue: [] });
    expect(hours).not.toBeNull();
    expect(fitsWorkingHours(hours!, new Date("2026-07-14T08:00:00Z"), new Date("2026-07-14T09:00:00Z"))).toBe(false);
  });

  it("adjacent windows are merged, so a visit may span them", () => {
    const hours = parseWorkingHours({ tue: [{ start: "07:00", end: "10:00" }, { start: "10:00", end: "14:00" }] })!;
    expect(fitsWorkingHours(hours, new Date("2026-07-14T08:30:00Z"), new Date("2026-07-14T10:30:00Z"))).toBe(true); // 09:30-11:30 BST
  });

  it("uses London time, not UTC", () => {
    const hours = parseWorkingHours({ tue: [{ start: "09:00", end: "10:00" }] })!;
    expect(fitsWorkingHours(hours, new Date("2026-07-14T08:00:00Z"), new Date("2026-07-14T09:00:00Z"))).toBe(true); // 09-10 BST
    expect(fitsWorkingHours(hours, new Date("2026-07-14T09:00:00Z"), new Date("2026-07-14T10:00:00Z"))).toBe(false);
  });

  it("checks overnight visits on each day, with 24:00 as the end of day", () => {
    const hours = parseWorkingHours({
      mon: [{ start: "20:00", end: "24:00" }],
      tue: [{ start: "00:00", end: "07:00" }],
    })!;
    // Mon 13 Jul 22:00 -> Tue 14 Jul 06:00 BST
    expect(fitsWorkingHours(hours, new Date("2026-07-13T21:00:00Z"), new Date("2026-07-14T05:00:00Z"))).toBe(true);
    // ... to 08:00 runs past the Tuesday window
    expect(fitsWorkingHours(hours, new Date("2026-07-13T21:00:00Z"), new Date("2026-07-14T07:00:00Z"))).toBe(false);
  });
});

describe("weekKey", () => {
  it("is the London Monday of the visit's week", () => {
    expect(weekKey("2026-07-14T08:00:00Z")).toBe("2026-07-13");
    expect(weekKey("2026-07-19T22:30:00Z")).toBe("2026-07-13"); // 23:30 BST on Sunday 19th: still that week
    expect(weekKey("2026-07-19T23:30:00Z")).toBe("2026-07-20"); // 00:30 BST on Monday 20th: next week
  });
});
