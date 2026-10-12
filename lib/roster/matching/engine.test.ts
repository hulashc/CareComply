import { describe, expect, it } from "vitest";
import { compareCandidates, filterCandidate, rankCandidates, scoreCandidate, topCandidates } from "./engine";
import { at, candidate, client, history, input } from "./fixtures";
import type { DistanceService } from "./distance";
import type { ScoredCandidate } from "./types";
import { WEIGHT_KEYS, type MatchingWeights } from "../weights";

const HOME = { lat: 51.51, lng: -0.1 };
const fixed = (minutes: number, km = 1): DistanceService => ({ estimate: () => ({ km, minutes }) });
const zeroWeights = () => Object.fromEntries(WEIGHT_KEYS.map((k) => [k, 0])) as MatchingWeights;
const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe("stage A: hard filters", () => {
  const base = input([]);

  it("keeps a plain eligible carer", () => {
    expect(filterCandidate(base, candidate())).toEqual([]);
  });

  it("removes a carer missing a required skill", () => {
    const i = input([], { visit: { ...base.visit, required_skills: ["hoist"] } });
    expect(codes(filterCandidate(i, candidate({}, { skills: ["medication"] })))).toEqual(["MISSING_SKILL"]);
    expect(filterCandidate(i, candidate({}, { skills: ["hoist"] }))).toEqual([]);
  });

  it("removes a carer on approved leave but keeps pending leave", () => {
    const leave = (status: string) => [{ absence_type: "annual_leave", start_date: "2026-07-13", end_date: "2026-07-15", status }];
    expect(codes(filterCandidate(base, candidate({ absences: leave("approved") })))).toEqual(["ON_LEAVE"]);
    expect(filterCandidate(base, candidate({ absences: leave("pending") }))).toEqual([]);
  });

  it("removes a carer who marked themselves unavailable, or is inactive", () => {
    expect(codes(filterCandidate(base, candidate({ unavailability: [{ starts_at: at("08:30"), ends_at: at("09:30") }] })))).toEqual(["UNAVAILABLE"]);
    expect(codes(filterCandidate(base, candidate({}, { status: "suspended" })))).toEqual(["CARER_INACTIVE"]);
    expect(codes(filterCandidate(base, candidate({}, { is_available: false })))).toEqual(["CARER_INACTIVE"]);
  });

  it("removes a carer with an overlapping visit, but not a cancelled or back-to-back one", () => {
    const v = (start: string, end: string, status = "assigned") => ({ id: "o", start_time: at(start), end_time: at(end), status });
    expect(codes(filterCandidate(base, candidate({ otherVisits: [v("09:30", "10:30")] })))).toEqual(["OVERLAP"]);
    expect(filterCandidate(base, candidate({ otherVisits: [v("09:30", "10:30", "cancelled")] }))).toEqual([]);
    expect(filterCandidate(base, candidate({ otherVisits: [v("08:00", "09:00"), v("10:00", "11:00")] }))).toEqual([]);
  });

  it("removes a carer the visit would take over max weekly hours", () => {
    const week = [{ id: "w", start_time: at("06:00", "2026-07-13"), end_time: at("15:30", "2026-07-13"), status: "assigned" }];
    expect(codes(filterCandidate(base, candidate({ otherVisits: week }, { max_weekly_hours: 10 })))).toEqual(["OVER_WEEKLY_HOURS"]);
    expect(filterCandidate(base, candidate({ otherVisits: week }, { max_weekly_hours: 10.5 }))).toEqual([]);
  });

  it("removes do-not-pair carers and those failing a required gender", () => {
    expect(codes(filterCandidate(base, candidate({ preference: "excluded" })))).toEqual(["EXCLUDED_CARER"]);
    const required = input([], { client: client({ preferred_carer_gender: "female", carer_gender_required: true }) });
    expect(codes(filterCandidate(required, candidate({}, { gender: "male" })))).toEqual(["GENDER_REQUIRED"]);
  });

  it("removes carers already on the visit", () => {
    const i = input([], { visit: { ...base.visit, assigned_carer_ids: ["c1"] } });
    expect(codes(filterCandidate(i, candidate()))).toEqual(["ALREADY_ASSIGNED"]);
  });

  it("does not remove for soft issues (pets, smoking, working hours, gender preference)", () => {
    const i = input([], { client: client({ pets: ["cat"], prefers_non_smoking_carer: true, preferred_carer_gender: "male" }) });
    const c = candidate({}, { pet_allergies: ["cat"], is_smoker: true, availability: { tue: [{ start: "18:00", end: "20:00" }] } });
    expect(filterCandidate(i, c)).toEqual([]);
  });

  it("rankCandidates reports why each carer was excluded", () => {
    const out = rankCandidates(input([candidate({ preference: "excluded" }), candidate({}, { id: "c2", full_name: "Bea" })]));
    expect(out.candidates.map((c) => c.carer_id)).toEqual(["c2"]);
    expect(out.excluded).toEqual([{ carer_id: "c1", full_name: "Amy Carer", issues: [expect.objectContaining({ code: "EXCLUDED_CARER" })] }]);
  });
});

describe("stage B: score", () => {
  it("matches the worked example: Σ wᵢfᵢ / Σ wᵢ over applicable factors", () => {
    // Applicable (client has no language/gender/smoker/pets/preferred list):
    //   continuity 20 × 0.65 (5 weekly visits) = 13
    //   travel     18 × 0.8  (9 min)           = 14.4
    //   avail      10 × 0.6  (no pattern/gaps) = 6
    //   workload   10 × 0.5  (no target)       = 5
    //   skills      7 × 0                      = 0
    //   transport   5 × 1    (1 km)            = 5
    // 43.4 / 70 × 100 = 62
    const c = candidate({ history: history(5) }, { ...HOME });
    const s = scoreCandidate(input([c], { distance: fixed(9, 1) }), c);
    expect(s.total).toBe(62);
    expect(s.breakdown.continuity).toEqual({ value: 0.65, weight: 20, points: 18.6, applicable: true });
    expect(s.breakdown.language).toEqual({ value: null, weight: 8, points: 0, applicable: false });
    expect(s.travel_minutes).toBe(9);
  });

  it("is 100 for a perfect candidate and stays within 0-100", () => {
    const i = input([], {
      client: client({ primary_language: "Gujarati", key_worker_id: "c1", has_preferred_carers: true, preferred_carer_gender: "female", prefers_non_smoking_carer: true, pets: ["cat"] }),
      distance: fixed(0, 0),
    });
    const c = candidate(
      { preference: "preferred", otherVisits: [{ id: "p", start_time: at("08:00"), end_time: at("09:00"), status: "assigned", ...HOME }] },
      { ...HOME, languages: ["Gujarati"], skills: ["a", "b", "c", "d", "e"], start_date: "2020-01-01", rating: 5, contract_hours: 1000, transport_mode: "car", availability: { tue: [{ start: "07:00", end: "12:00" }] } },
    );
    expect(scoreCandidate(i, c).total).toBe(100);
    expect(scoreCandidate(input([candidate()], { distance: fixed(100, 50) }), candidate()).total).toBeGreaterThanOrEqual(0);
  });

  it("is 0 when every weight is 0", () => {
    const c = candidate({ history: history(5) });
    expect(scoreCandidate(input([c], { weights: zeroWeights() }), c).total).toBe(0);
  });

  it("org weights change the ranking", () => {
    const near = candidate({}, { id: "near", full_name: "Near", ...HOME });
    // "loyal" knows the client well but lives far away; travel is measured home -> client.
    const loyalFar = candidate({ history: history(10) }, { id: "loyal", full_name: "Loyal", lat: 52.5, lng: -0.1 });
    const legs: DistanceService = { estimate: (from) => (from.lat === 52.5 ? { km: 40, minutes: 45 } : { km: 1, minutes: 2 }) };
    const travelHeavy = { ...zeroWeights(), travel: 100, continuity: 10 };
    const continuityHeavy = { ...zeroWeights(), travel: 10, continuity: 100 };
    expect(topCandidates(input([near, loyalFar], { weights: travelHeavy, distance: legs })).map((c) => c.carer_id)).toEqual(["near", "loyal"]);
    expect(topCandidates(input([near, loyalFar], { weights: continuityHeavy, distance: legs })).map((c) => c.carer_id)).toEqual(["loyal", "near"]);
  });

  it("collects reasons and warnings, including pending leave from eligibility", () => {
    const i = input([], { client: client({ primary_language: "Gujarati" }), distance: fixed(6, 1) });
    const c = candidate(
      { history: history(14, 5), absences: [{ absence_type: "annual_leave", start_date: "2026-07-14", end_date: "2026-07-14", status: "pending" }], otherVisits: [{ id: "w", start_time: at("06:00", "2026-07-13"), end_time: at("19:00", "2026-07-13"), status: "assigned" }] },
      { ...HOME, languages: ["Gujarati"], contract_hours: 13.5 },
    );
    const s = scoreCandidate(i, c);
    expect(s.reasons.slice(0, 3)).toEqual(["Visited Mrs Patel 14 times", "6 min from home", "Speaks Gujarati"]);
    expect(s.warnings).toEqual(["Carer has a pending annual leave request (2026-07-14 to 2026-07-14)", "Would reach 14h this week (contract 13.5h)"]);
  });
});

describe("ranking", () => {
  const scored = (over: Partial<ScoredCandidate>): ScoredCandidate => ({
    carer_id: "x", full_name: "X", total: 50, travel_minutes: null, reasons: [], warnings: [],
    breakdown: { continuity: { value: 0, weight: 20, points: 0, applicable: true } } as ScoredCandidate["breakdown"],
    ...over,
  });
  const cont = (value: number) => ({ continuity: { value, weight: 20, points: 0, applicable: true } }) as ScoredCandidate["breakdown"];

  it("breaks ties by continuity, then travel, then name, then id", () => {
    expect(compareCandidates(scored({ total: 60 }), scored({ total: 50 }))).toBeLessThan(0);
    expect(compareCandidates(scored({ breakdown: cont(0.9) }), scored({ breakdown: cont(0.1) }))).toBeLessThan(0);
    expect(compareCandidates(scored({ travel_minutes: 5 }), scored({ travel_minutes: 10 }))).toBeLessThan(0);
    expect(compareCandidates(scored({ travel_minutes: 5 }), scored({ travel_minutes: null }))).toBeLessThan(0);
    expect(compareCandidates(scored({ full_name: "Amy" }), scored({ full_name: "Bea" }))).toBeLessThan(0);
    expect(compareCandidates(scored({ carer_id: "a" }), scored({ carer_id: "b" }))).toBeLessThan(0);
  });

  it("is deterministic regardless of input order", () => {
    const people = ["Cara", "Amy", "Bea", "Dee", "Amy"].map((name, i) => candidate({}, { id: `c${i}`, full_name: name }));
    const order = (list: typeof people) => topCandidates(input(list), 5).map((c) => c.carer_id);
    expect(order(people)).toEqual(["c1", "c4", "c2", "c0", "c3"]);
    expect(order([...people].reverse())).toEqual(order(people));
  });

  it("topCandidates returns at most 3, fewer when fewer qualify, none when none do", () => {
    const many = Array.from({ length: 6 }, (_, i) => candidate({}, { id: `c${i}`, full_name: `C${i}` }));
    expect(topCandidates(input(many))).toHaveLength(3);
    expect(topCandidates(input(many.slice(0, 2)))).toHaveLength(2);
    expect(topCandidates(input([]))).toEqual([]);
    expect(topCandidates(input([candidate({ preference: "excluded" })]))).toEqual([]);
  });
});

describe("drag preview (a visit scored at another time, with its current carer treated as unassigned)", () => {
  const base = input([]);
  const shifted = (start: string, end: string, assigned: string[] = []) => ({
    ...base.visit, start_time: at(start), end_time: at(end), assigned_carer_ids: assigned,
  });

  it("an assigned carer is only a drop target once removed from the visit", () => {
    const c = candidate({}, { id: "c1" });
    expect(codes(filterCandidate(input([c], { visit: shifted("09:00", "10:00", ["c1"]) }), c))).toEqual(["ALREADY_ASSIGNED"]);
    expect(filterCandidate(input([c], { visit: shifted("09:00", "10:00", []) }), c)).toEqual([]);
  });

  it("leave and overlaps are judged at the hypothetical time, ignoring the dragged visit itself", () => {
    const leaveTomorrow = [{ absence_type: "annual_leave", start_date: "2026-07-15", end_date: "2026-07-15", status: "approved" }];
    const own = { id: "v1", start_time: at("09:00"), end_time: at("10:00"), status: "assigned" };
    const other = { id: "v2", start_time: at("14:00"), end_time: at("15:00"), status: "assigned" };
    const c = candidate({ absences: leaveTomorrow, otherVisits: [own, other] });
    expect(filterCandidate(input([c], { visit: shifted("09:30", "10:30") }), c)).toEqual([]);
    expect(codes(filterCandidate(input([c], { visit: shifted("14:30", "15:30") }), c))).toEqual(["OVERLAP"]);
    const nextDay = { ...base.visit, start_time: at("09:00", "2026-07-15"), end_time: at("10:00", "2026-07-15") };
    expect(codes(filterCandidate(input([c], { visit: nextDay }), c))).toEqual(["ON_LEAVE"]);
  });
});
