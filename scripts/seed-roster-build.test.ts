import { describe, expect, it } from "vitest";
import { londonDateOf } from "../lib/dates/london";
import { buildDemoRoster } from "./seed-roster-build";
import { CARERS, CLIENTS } from "./seed-roster-data";

const ORG = "00000000-0000-4000-8000-0000000000a1";
const build = (today = "2026-10-12", now = new Date("2026-10-12T14:30:00Z")) =>
  buildDemoRoster({ orgId: ORG, adminId: null, today, now });

// Checks the generated roster against the rules independently of the eligibility code that
// produced it, so the seed cannot quietly drift into data the API would reject.
describe("buildDemoRoster", () => {
  const roster = build();
  const visits = roster.plans.flatMap((p) => p.shift_inserts);
  const adds = roster.plans.flatMap((p) => p.assignment_adds);
  const carerKeyById = new Map(roster.carers.map((c) => [c.id as string, CARERS.find((k) => k.name === c.full_name)!]));
  const clientKeyById = new Map(roster.clients.map((c) => [c.id as string, CLIENTS.find((k) => k.name === c.full_name)!]));
  const visitById = new Map(visits.map((v) => [v.id, v]));

  it("has the requested shape: ~15 carers, ~25 clients, two weeks of visits", () => {
    expect(roster.carers).toHaveLength(15);
    expect(roster.clients).toHaveLength(25);
    expect(roster.stats.series).toBeGreaterThanOrEqual(45);
    const days = new Set(visits.map((v) => v.occurrence_date));
    expect(days.size).toBe(14);
    expect(visits.length).toBeGreaterThan(600);
  });

  it("includes unassigned visits, leave, unavailability and a double-up", () => {
    expect(roster.stats.unassignedVisits).toBeGreaterThan(20);
    expect(roster.stats.assignedVisits).toBeGreaterThan(roster.stats.unassignedVisits);
    expect(roster.absences.length).toBeGreaterThanOrEqual(3);
    expect(roster.absences.some((a) => a.absence_type === "sick_leave")).toBe(true);
    expect(roster.absences.some((a) => a.status === "pending")).toBe(true);
    expect(roster.unavailability).toHaveLength(3);
    expect(roster.stats.fullyStaffedDoubleUps).toBeGreaterThan(0);
    expect(roster.stats.halfStaffedDoubleUps).toBeGreaterThan(0);
  });

  it("splits the fortnight into a published week and a draft week", () => {
    const published = visits.filter((v) => v.roster_state === "published");
    expect(new Set(published.map((v) => v.occurrence_date)).size).toBe(7);
    expect(roster.stats.published + roster.stats.draft).toBe(visits.length);
    expect(roster.stats.draft).toBeGreaterThan(0);
  });

  it("never double-books a carer and never exceeds capacity", () => {
    expect(roster.stats.conflicts).toBe(0);
    const perVisit = new Map<string, number>();
    for (const a of adds) perVisit.set(a.shift_id, (perVisit.get(a.shift_id) ?? 0) + 1);
    for (const [id, n] of perVisit) expect(n).toBeLessThanOrEqual(visitById.get(id)!.required_carers);

    const byCarer = new Map<string, { start: number; end: number }[]>();
    for (const a of adds) {
      const v = visitById.get(a.shift_id)!;
      byCarer.set(a.carer_id, [...(byCarer.get(a.carer_id) ?? []), { start: Date.parse(v.start_time), end: Date.parse(v.end_time) }]);
    }
    for (const list of byCarer.values()) {
      list.sort((a, b) => a.start - b.start);
      for (let i = 1; i < list.length; i++) expect(list[i].start).toBeGreaterThanOrEqual(list[i - 1].end);
    }
  });

  it("respects approved leave, the do-not-pair list, strict gender and required skills", () => {
    const approved = roster.absences.filter((a) => a.status === "approved");
    for (const a of adds) {
      const v = visitById.get(a.shift_id)!;
      const carer = carerKeyById.get(a.carer_id)!;
      const client = clientKeyById.get(v.client_id)!;
      const day = londonDateOf(new Date(v.start_time));

      const onLeave = approved.some((l) => l.carer_id === a.carer_id && (l.start_date as string) <= day && day <= (l.end_date as string));
      expect(onLeave, `${carer.name} on leave ${day}`).toBe(false);
      expect(client.excluded?.some((e) => e.key === carer.key), `${client.name} excludes ${carer.name}`).toBeFalsy();
      if (client.genderRequired) expect(carer.gender.toLowerCase()).toBe(client.genderPref);
      for (const skill of v.required_skills) expect(carer.skills, `${carer.name} lacks ${skill}`).toContain(skill);
      expect(client.pets?.some((p) => carer.petAllergies?.includes(p)), `${carer.name} allergic to ${client.name}'s pet`).toBeFalsy();
    }
  });

  it("keeps carers inside their weekly hour limits", () => {
    const hours = new Map<string, number>(); // carer + week
    for (const a of adds) {
      const v = visitById.get(a.shift_id)!;
      const weekStart = new Date(v.start_time);
      weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
      const key = `${a.carer_id}:${weekStart.toISOString().slice(0, 10)}`;
      hours.set(key, (hours.get(key) ?? 0) + (Date.parse(v.end_time) - Date.parse(v.start_time)) / 3_600_000);
    }
    for (const [key, h] of hours) {
      const carer = carerKeyById.get(key.split(":")[0])!;
      expect(h, `${carer.name} ${key.split(":")[1]}`).toBeLessThanOrEqual(carer.maxWeeklyHours + 1e-6);
    }
  });

  it("only double-up visits need two carers, and the hoist clients are the double-ups", () => {
    const twoCarer = new Set(visits.filter((v) => v.required_carers === 2).map((v) => clientKeyById.get(v.client_id)!.key));
    expect([...twoCarer].sort()).toEqual(["leonard", "maureen"]);
  });

  it("is deterministic for the same date, and differs on another date", () => {
    const a = build();
    const b = build();
    expect(a.stats).toEqual(b.stats);
    expect(a.plans.flatMap((p) => p.assignment_adds).length).toBe(adds.length);
    expect(build("2026-11-02", new Date("2026-11-02T14:30:00Z")).stats.visits).toBeGreaterThan(600);
  });

  it("tags everything it creates so --clean can remove exactly it", () => {
    for (const c of roster.carers) {
      expect(c.notes as string).toMatch(/^\[roster-demo\]/);
      expect(c.email as string).toMatch(/@roster-demo\.test$/);
    }
    for (const c of roster.clients) expect(c.care_notes as string).toMatch(/^\[roster-demo\]/);
    for (const a of roster.absences) expect(a.reason as string).toMatch(/^\[roster-demo\]/);
  });

  it("produces times the shifts table accepts (end after start, actual end after actual start)", () => {
    for (const v of visits) expect(Date.parse(v.end_time)).toBeGreaterThan(Date.parse(v.start_time));
    for (const c of roster.updates.completed) expect(Date.parse(c.actual_end)).toBeGreaterThan(Date.parse(c.actual_start));
  });
});

describe("buildDemoRoster scaled for performance testing", () => {
  const big = buildDemoRoster({ orgId: ORG, adminId: null, today: "2026-10-12", now: new Date("2026-10-12T14:30:00Z"), scale: 100 });
  it("produces ~100 carers and ~1,000 visits a week with no double-booking", () => {
    expect(big.carers).toHaveLength(100);
    expect(big.clients).toHaveLength(75);
    const perWeek = big.stats.visits / 2;
    expect(perWeek).toBeGreaterThan(900);
    expect(perWeek).toBeLessThan(1300);
    expect(big.stats.conflicts).toBe(0);
    expect(new Set(big.carers.map((c) => c.email)).size).toBe(100); // unique emails
    expect(new Set(big.carers.map((c) => c.full_name)).size).toBe(100);
  });
});
