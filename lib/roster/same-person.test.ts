import { describe, expect, it } from "vitest";
import { checkEligibility, canAssign, type EligibilityInput } from "./eligibility";
import { isSamePerson, normaliseName } from "./same-person";
import { carerConflicts, detectConflicts, hasBlocking } from "../roster-ui/conflicts";
import type { RosterCarer } from "../roster-ui/types";
import type { VisitRow } from "./types";

describe("isSamePerson", () => {
  it("matches the same name regardless of case and spacing", () => {
    expect(isSamePerson({ name: "Kofi Reed" }, { name: "kofi  reed " })).toBe(true);
    expect(normaliseName("  Kofi   REED ")).toBe("kofi reed");
  });

  it("matches the same id", () => {
    expect(isSamePerson({ id: "x", name: "A" }, { id: "x", name: "B" })).toBe(true);
  });

  it("does not match different people, or empty names", () => {
    expect(isSamePerson({ id: "1", name: "Kofi Reed" }, { id: "2", name: "Kofi Rudd" })).toBe(false);
    expect(isSamePerson({ name: "" }, { name: "" })).toBe(false);
    expect(isSamePerson({ name: null }, { name: undefined })).toBe(false);
  });
});

const input = (client: string, carer: string): EligibilityInput => ({
  carer: { id: "c1", full_name: carer, status: "active", is_available: true, gender: null, skills: [], pet_allergies: [], is_smoker: false, max_weekly_hours: null, availability: {} },
  client: { id: "cl1", full_name: client, preferred_carer_gender: null, carer_gender_required: false, prefers_non_smoking_carer: false, pets: [] },
  visit: { id: "v", start_time: "2026-07-14T08:00:00Z", end_time: "2026-07-14T09:00:00Z", required_skills: [] },
  preference: null,
  absences: [],
  unavailability: [],
  otherVisits: [],
});

describe("server eligibility: a client is never their own carer", () => {
  it("is a BLOCKED issue that force cannot override", () => {
    const e = checkEligibility(input("Kofi Reed", "Kofi Reed"));
    expect(e.blocked.map((i) => i.code)).toContain("SAME_PERSON");
    expect(canAssign(e, true)).toBe(false);
  });

  it("applies to any client and carer with the same name", () => {
    for (const name of ["Eleanor Whitmore", "Sophie James", "Aisha Khan"]) {
      expect(checkEligibility(input(name, name.toUpperCase())).blocked.map((i) => i.code)).toContain("SAME_PERSON");
    }
  });

  it("does not affect different people", () => {
    expect(checkEligibility(input("Kofi Reed", "Ann Smith")).blocked).toEqual([]);
  });
});

const carer = (id: string, name: string): RosterCarer => ({
  carer_id: id, full_name: name, status: "active", is_available: true, working_hours: {}, max_weekly_hours: null,
  contract_hours: null, location_id: null, team: null, skills: [], gender: null, absences: [], unavailability: [],
});
const visit = (clientName: string, carerId: string, carerName: string): VisitRow => ({
  id: "v1", org_id: "o", client_id: "cl1", client_name: clientName, location_id: null,
  start_time: "2026-07-14T08:00:00.000Z", end_time: "2026-07-14T09:00:00.000Z", status: "assigned", roster_state: "draft",
  published_at: null, required_carers: 1, required_skills: [], notes: null, series_id: null, occurrence_date: null,
  is_series_exception: false, actual_start: null, actual_end: null, created_at: "", updated_at: "",
  carers: [{ carer_id: carerId, full_name: carerName, slot: 1 }], open_slots: 0,
});

describe("calendar conflicts: client as carer", () => {
  it("is a blocking conflict (drags, pastes and reassigns are refused)", () => {
    const v = visit("Kofi Reed", "c1", "Kofi Reed");
    const m = detectConflicts([v], [carer("c1", "Kofi Reed")]);
    expect(m.get("v1")?.map((c) => c.code)).toContain("SAME_PERSON");
    expect(hasBlocking(m.get("v1"))).toBe(true);
  });

  it("is caught for a hypothetical placement too (live drag preview)", () => {
    const v = visit("Kofi Reed", "x", "Someone");
    expect(carerConflicts(v, carer("c9", "kofi reed"), []).some((c) => c.code === "SAME_PERSON" && c.blocking)).toBe(true);
  });

  it("does not flag different people", () => {
    const v = visit("Kofi Reed", "c2", "Ann Smith");
    expect(detectConflicts([v], [carer("c2", "Ann Smith")]).size).toBe(0);
  });
});
