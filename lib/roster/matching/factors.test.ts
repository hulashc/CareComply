import { describe, expect, it } from "vitest";
import { evaluateFactors } from "./factors";
import { VISIT_END, VISIT_START, at, candidate, client, history, input } from "./fixtures";
import type { DistanceService } from "./distance";
import type { Candidate, MatchInput } from "./types";

const HOME = { lat: 51.51, lng: -0.1 };
const ELSEWHERE = { lat: 51.55, lng: -0.1 };

/** A stub service: fixed minutes and km per leg, regardless of points. */
const fixed = (minutes: number, km = 1): DistanceService => ({ estimate: () => ({ km, minutes }) });

const run = (c: Candidate, over: Partial<MatchInput> = {}) => evaluateFactors(input([c], over), c);

describe("continuity", () => {
  it("is 0 with no history and gives no reason", () => {
    const f = run(candidate()).continuity;
    expect(f.value).toBe(0);
    expect(f.reasons).toEqual([]);
  });

  it("combines visits in the last 90 days with recent frequency (28 days)", () => {
    // 5 weekly visits: n = 5, r = 4 (days 7, 14, 21, 28) -> 0.7*0.5 + 0.3*1
    expect(run(candidate({ history: history(5) })).continuity.value).toBeCloseTo(0.65, 6);
    // 3 visits a month apart: n = 3, r = 0 (day 30 is outside 28) -> 0.7*0.3
    expect(run(candidate({ history: history(3, 30) })).continuity.value).toBeCloseTo(0.21, 6);
  });

  it("caps at 1 and ignores visits older than 90 days, cancelled or not before this visit", () => {
    expect(run(candidate({ history: history(20) })).continuity.value).toBe(1);
    const old = [{ start_time: "2026-01-01T09:00:00Z", status: "completed" }];
    const cancelled = history(2).map((h) => ({ ...h, status: "cancelled" }));
    const future = [{ start_time: "2026-07-20T09:00:00Z", status: "assigned" }];
    expect(run(candidate({ history: [...old, ...cancelled, ...future] })).continuity.value).toBe(0);
  });

  it("names the client in the reason", () => {
    expect(run(candidate({ history: history(14, 5) })).continuity.reasons).toEqual(["Visited Mrs Patel 14 times"]);
    expect(run(candidate({ history: history(1) })).continuity.reasons).toEqual(["Visited Mrs Patel once"]);
    const plain = evaluateFactors(input([candidate({ history: history(2) })], { client: client({ display_name: null }) }), candidate({ history: history(2) }));
    expect(plain.continuity.reasons).toEqual(["Visited Asha Patel 2 times"]);
  });

  it("scores the key worker as 1", () => {
    const f = run(candidate(), { client: client({ key_worker_id: "c1" }) }).continuity;
    expect(f.value).toBe(1);
    expect(f.reasons).toContain("Key worker");
  });
});

describe("client preferences", () => {
  it("preferred carer applies only when the client has a preferred list", () => {
    expect(run(candidate({ preference: "preferred" })).preferred_carer.value).toBeNull();
    const withList = { client: client({ has_preferred_carers: true }) };
    const yes = run(candidate({ preference: "preferred" }), withList).preferred_carer;
    expect(yes.value).toBe(1);
    expect(yes.reasons).toEqual(["On Mrs Patel's preferred list"]);
    expect(run(candidate(), withList).preferred_carer.value).toBe(0);
  });

  it("language applies only when the client's language is recorded, matching case-insensitively", () => {
    expect(run(candidate({}, { languages: ["Gujarati"] })).language.value).toBeNull();
    const withLang = { client: client({ primary_language: "gujarati" }) };
    const yes = run(candidate({}, { languages: ["English", "Gujarati"] }), withLang).language;
    expect(yes.value).toBe(1);
    expect(yes.reasons).toEqual(["Speaks Gujarati"]);
    expect(run(candidate({}, { languages: ["English"] }), withLang).language.value).toBe(0);
  });

  it("gender applies only when the client has a preference", () => {
    expect(run(candidate()).gender_preference.value).toBeNull();
    expect(run(candidate({}, { gender: "F" }), { client: client({ preferred_carer_gender: "female" }) }).gender_preference.value).toBe(1);
    expect(run(candidate({}, { gender: "male" }), { client: client({ preferred_carer_gender: "female" }) }).gender_preference.value).toBe(0);
    expect(run(candidate({}, { gender: null }), { client: client({ preferred_carer_gender: "female" }) }).gender_preference.value).toBe(0);
  });

  it("smoker applies only when the client prefers a non-smoker", () => {
    expect(run(candidate({}, { is_smoker: true })).smoker_preference.value).toBeNull();
    const pref = { client: client({ prefers_non_smoking_carer: true }) };
    expect(run(candidate({}, { is_smoker: false }), pref).smoker_preference.value).toBe(1);
    const smoker = run(candidate({}, { is_smoker: true }), pref).smoker_preference;
    expect(smoker.value).toBe(0);
    expect(smoker.warnings).toEqual(["Smoker; client prefers a non-smoking carer"]);
  });

  it("pet allergy applies only when the client has pets", () => {
    expect(run(candidate({}, { pet_allergies: ["cat"] })).pet_allergy.value).toBeNull();
    const pets = { client: client({ pets: ["Cat", "dog"] }) };
    expect(run(candidate({}, { pet_allergies: ["horse"] }), pets).pet_allergy.value).toBe(1);
    const allergic = run(candidate({}, { pet_allergies: ["cat"] }), pets).pet_allergy;
    expect(allergic.value).toBe(0);
    expect(allergic.warnings).toEqual(["Allergic to the client's cat"]);
  });
});

describe("travel", () => {
  it("measures from home when there is no earlier visit that day", () => {
    const f = run(candidate({}, { lat: HOME.lat, lng: HOME.lng }), { distance: fixed(6) }).travel;
    expect(f.value).toBeCloseTo(1 - 6 / 45, 6);
    expect(f.reasons).toEqual(["6 min from home"]);
  });

  it("averages the legs from the previous visit and to the next visit", () => {
    const legs: DistanceService = { estimate: (from) => (from.lat === ELSEWHERE.lat ? { km: 3, minutes: 10 } : { km: 6, minutes: 20 }) };
    const c = candidate({
      otherVisits: [
        { id: "p", start_time: at("07:30"), end_time: at("08:30"), status: "assigned", ...ELSEWHERE },
        { id: "n", start_time: at("11:00"), end_time: at("12:00"), status: "assigned", lat: 51.6, lng: -0.1 },
      ],
    }, { lat: HOME.lat, lng: HOME.lng });
    const f = run(c, { distance: legs }).travel;
    expect(f.value).toBeCloseTo(1 - 15 / 45, 6);
    expect(f.reasons).toEqual(["10 min from previous visit"]);
  });

  it("ignores visits on other days and cancelled visits", () => {
    const c = candidate({
      otherVisits: [
        { id: "y", start_time: at("07:00", "2026-07-13"), end_time: at("08:00", "2026-07-13"), status: "completed", ...ELSEWHERE },
        { id: "x", start_time: at("07:00"), end_time: at("08:00"), status: "cancelled", ...ELSEWHERE },
      ],
    }, { lat: HOME.lat, lng: HOME.lng });
    expect(run(c, { distance: fixed(9) }).travel.reasons).toEqual(["9 min from home"]);
  });

  it("is 0 at 45 minutes or more", () => {
    expect(run(candidate({}, { lat: HOME.lat, lng: HOME.lng }), { distance: fixed(45) }).travel.value).toBe(0);
    expect(run(candidate({}, { lat: HOME.lat, lng: HOME.lng }), { distance: fixed(90) }).travel.value).toBe(0);
  });

  it("is neutral (0.5) when there are no coordinates", () => {
    expect(run(candidate(), { distance: fixed(1) }).travel.value).toBe(0.5);
    expect(run(candidate({}, { lat: 1, lng: 1 }), { distance: fixed(1), client: client({ lat: null, lng: null }) }).travel.value).toBe(0.5);
  });

  it("warns when there is not enough time to get there from the previous visit", () => {
    const c = candidate({ otherVisits: [{ id: "p", start_time: at("08:00"), end_time: at("08:55"), status: "assigned", ...ELSEWHERE }] });
    expect(run(c, { distance: fixed(12) }).travel.warnings).toEqual(["Only 5 min between visits but 12 min travel"]);
  });

  it("uses the haversine fallback when no service is given", () => {
    const f = run(candidate({}, { lat: CLIENT_LAT_PLUS(0.01), lng: -0.1, transport_mode: "car" })).travel;
    expect(f.value).toBeGreaterThan(0.9);
    expect(f.value).toBeLessThan(1);
  });
});
const CLIENT_LAT_PLUS = (d: number) => 51.5 + d;

describe("availability fit and contiguity", () => {
  it("no working pattern and no other visits that day is 0.5*0.7 + 0.5*0.5", () => {
    expect(run(candidate()).availability_fit.value).toBeCloseTo(0.6, 6);
  });

  it("inside working hours and right next to another visit is 1", () => {
    const c = candidate(
      { otherVisits: [{ id: "p", start_time: at("08:00"), end_time: at("08:45"), status: "assigned" }] },
      { availability: { tue: [{ start: "07:00", end: "14:00" }] } },
    );
    expect(run(c).availability_fit.value).toBe(1);
  });

  it("outside working hours scores 0 for that half and warns", () => {
    const f = run(candidate({}, { availability: { tue: [{ start: "12:00", end: "18:00" }] } })).availability_fit;
    expect(f.value).toBeCloseTo(0.25, 6);
    expect(f.warnings).toEqual(["Outside the carer's usual working hours"]);
  });

  it("contiguity falls linearly from a 30 to a 180 minute gap, using the nearest visit", () => {
    const withGap = (endHHmm: string) => candidate(
      { otherVisits: [{ id: "p", start_time: at("05:00"), end_time: at(endHHmm), status: "assigned" }] },
      { availability: { tue: [{ start: "00:00", end: "24:00" }] } },
    );
    expect(run(withGap("06:00")).availability_fit.value).toBeCloseTo(0.5, 6); // 180 min gap
    expect(run(withGap("07:15")).availability_fit.value).toBeCloseTo(0.75, 6); // 105 min gap
    expect(run(withGap("08:30")).availability_fit.value).toBe(1); // 30 min gap
  });

  it("handles a visit that crosses midnight against the windows of both days", () => {
    const overnight = { start_time: at("23:00"), end_time: at("01:00", "2026-07-15") };
    const both = candidate({}, { availability: { tue: [{ start: "22:00", end: "24:00" }], wed: [{ start: "00:00", end: "02:00" }] } });
    const tueOnly = candidate({}, { availability: { tue: [{ start: "22:00", end: "24:00" }] } });
    const over = { visit: { ...input([]).visit, ...overnight } };
    expect(evaluateFactors(input([both], over), both).availability_fit.warnings).toEqual([]);
    expect(evaluateFactors(input([tueOnly], over), tueOnly).availability_fit.warnings).toHaveLength(1);
  });
});

describe("workload balance", () => {
  const booked = (hours: number, day = "2026-07-13") => ({
    id: `b${hours}${day}`, start_time: at("06:00", day), end_time: new Date(new Date(at("06:00", day)).getTime() + hours * 3_600_000).toISOString(), status: "assigned",
  });

  it("is neutral with no contract or max hours", () => {
    expect(run(candidate({ otherVisits: [booked(10)] })).workload_balance.value).toBe(0.5);
  });

  it("rewards headroom against contract hours", () => {
    const f = run(candidate({ otherVisits: [booked(10)] }, { contract_hours: 20 })).workload_balance;
    expect(f.value).toBeCloseTo(0.5, 6);
    expect(f.warnings).toEqual([]);
  });

  it("falls back to max hours when there is no contract", () => {
    expect(run(candidate({ otherVisits: [booked(5)] }, { max_weekly_hours: 20 })).workload_balance.value).toBeCloseTo(0.75, 6);
  });

  it("is 0 and warns when the visit takes the carer over contract hours", () => {
    const f = run(candidate({ otherVisits: [booked(12), booked(12, "2026-07-15"), booked(13, "2026-07-16")] }, { contract_hours: 37.5 })).workload_balance;
    expect(f.value).toBe(0);
    expect(f.warnings).toEqual(["Would reach 38h this week (contract 37.5h)"]);
  });

  it("warns when within 2 hours of max weekly hours", () => {
    const f = run(candidate({ otherVisits: [booked(12), booked(12, "2026-07-15"), booked(13, "2026-07-16")] }, { max_weekly_hours: 40 })).workload_balance;
    expect(f.warnings).toEqual(["Would reach 38h this week (max 40h)"]);
  });

  it("only counts non-cancelled visits in the same Monday-Sunday week", () => {
    const lastWeek = booked(30, "2026-07-12"); // Sunday before
    const cancelled = { ...booked(10), id: "cx", status: "cancelled" };
    expect(run(candidate({ otherVisits: [lastWeek, cancelled] }, { contract_hours: 20 })).workload_balance.value).toBe(1);
  });
});

describe("skills and experience", () => {
  it("averages extra skills, years of experience and rating when present", () => {
    const c = candidate({}, { skills: ["hoist", "a", "b", "c"], start_date: "2023-07-14", rating: 5 });
    const f = run(c, { visit: { ...input([]).visit, required_skills: ["hoist"] } }).skills_experience;
    expect(f.value).toBeCloseTo((0.6 + 1 + 1) / 3, 6);
    expect(f.reasons).toEqual(["3 years' experience"]);
  });

  it("uses only the skills part when nothing else is known", () => {
    expect(run(candidate({}, { skills: [] })).skills_experience.value).toBe(0);
    expect(run(candidate({}, { skills: ["a", "b", "c", "d", "e", "f"] })).skills_experience.value).toBe(1);
  });

  it("scales rating 1-5 to 0-1 and ignores bad ratings", () => {
    expect(run(candidate({}, { skills: [], rating: 3 })).skills_experience.value).toBeCloseTo(0.25, 6);
    expect(run(candidate({}, { skills: [], rating: 9 })).skills_experience.value).toBe(0);
  });

  it("treats a future start date as no experience", () => {
    expect(run(candidate({}, { skills: [], start_date: "2027-01-01" })).skills_experience.value).toBe(0);
  });
});

describe("transport", () => {
  const far = { distance: fixed(15, 5) };
  const home = { lat: HOME.lat, lng: HOME.lng };

  it("is 1 when no leg needs driving", () => {
    expect(run(candidate({}, { ...home, transport_mode: "walking" }), { distance: fixed(5, 0.5) }).transport.value).toBe(1);
    expect(run(candidate({}, { transport_mode: "walking" })).transport.value).toBe(1); // no legs at all
  });

  it("scores by mode when a leg is over 2 km", () => {
    const drives = run(candidate({}, { ...home, transport_mode: "car" }), far).transport;
    expect(drives.value).toBe(1);
    expect(drives.reasons).toEqual(["Drives"]);
    expect(run(candidate({}, { ...home, driving_licence: true, has_vehicle: true }), far).transport.value).toBe(1);
    expect(run(candidate({}, { ...home, transport_mode: "public_transport" }), far).transport.value).toBe(0.5);
    expect(run(candidate({}, { ...home, transport_mode: "bicycle" }), far).transport.value).toBe(0.5);
    expect(run(candidate({}, { ...home, transport_mode: "walking" }), far).transport.value).toBe(0);
    expect(run(candidate({}, { ...home }), far).transport.value).toBe(0.3);
  });

  it("a licence without a vehicle is not driving", () => {
    expect(run(candidate({}, { ...home, driving_licence: true, has_vehicle: false }), far).transport.value).toBe(0.3);
  });
});

it("fixtures describe a one-hour visit", () => {
  expect(new Date(VISIT_END).getTime() - new Date(VISIT_START).getTime()).toBe(3_600_000);
});
