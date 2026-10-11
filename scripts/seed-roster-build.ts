import { addDays, londonWallClockToInstant, parseCalendarDate, toDateString } from "../lib/dates/london";
import { canAssign, checkEligibility, type EligibilityCarer, type EligibilityClient } from "../lib/roster/eligibility";
import { planCreate } from "../lib/roster/series-plan";
import { emptyPlan, type RosterPlan, type ShiftInsert } from "../lib/roster/types";
import {
  AREAS,
  DEMO_TAG,
  PATTERNS,
  expandCarers,
  expandClients,
  type CallKind,
  type DemoCarer,
  type DemoClient,
} from "./seed-roster-data";

// Builds the whole demo roster in memory, with no database access, so it is deterministic,
// testable and can run with --dry-run. The CLI (seed-roster.ts) just writes the result.
//
// Visits come from the same planner the API uses (recurring series -> visits), and carers are put
// on them with the same eligibility rules (no force), so the seed cannot create a roster the API
// would reject: leave, sickness and unavailability naturally leave gaps.

export const WINDOW_DAYS = 14;
const PUBLISHED_DAYS = 7; // days 1-7 published, days 8-14 draft
/** When a regular carer cannot do a visit, how often a coordinator finds cover (the rest stay open). */
const CHANCE_OF_COVER = 0.75;

export interface BuildOptions {
  orgId: string;
  adminId: string | null;
  /** London date, YYYY-MM-DD. */
  today: string;
  now: Date;
  seed?: number;
  /** Target number of carers; clients are 75% of it. Omit for the hand-written 15 / 25. */
  scale?: number;
}

type Row = Record<string, unknown>;

export interface DemoRoster {
  carers: Row[];
  clients: Row[];
  preferences: Row[];
  absences: Row[];
  unavailability: Row[];
  /** One plan per recurring series: the template, its visits and their assignments. */
  plans: RosterPlan[];
  updates: {
    completed: { id: string; actual_start: string; actual_end: string }[];
    inProgress: { id: string; actual_start: string }[];
    confirmed: string[];
  };
  stats: Stats;
}

export interface Stats {
  carers: number;
  clients: number;
  series: number;
  visits: number;
  assignedVisits: number;
  unassignedVisits: number;
  doubleUpVisits: number;
  fullyStaffedDoubleUps: number;
  halfStaffedDoubleUps: number;
  published: number;
  draft: number;
  completed: number;
  inProgress: number;
  confirmed: number;
  /** Overlapping visits for the same carer: must be 0. */
  conflicts: number;
}

/** Small deterministic PRNG so every run with the same seed and date is identical. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
const round5 = (m: number) => Math.round(m / 5) * 5;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const STREETS = ["Victoria Road", "Welford Road", "Narborough Road", "Evington Road", "Melton Road", "Hinckley Road", "Queens Road", "Station Road", "Church Lane", "Park Avenue", "Mill Lane", "Oakfield Close"];
const dayOffset = (today: string, n: number) => toDateString(addDays(parseCalendarDate(today), n));

interface CallSpec {
  start: number;
  duration: number;
  weekdays: number[];
}

function callSpec(kind: CallKind, index: number, client: DemoClient): CallSpec {
  const heavy = !!client.doubleUp?.includes(kind) || client.skills.includes("hoist_transfers") || client.skills.includes("end_of_life");
  switch (kind) {
    case "morning":
      return { start: round5(405 + ((index * 20) % 195)), duration: heavy ? 60 : client.skills.includes("medication_admin") && client.skills.length === 1 ? 30 : 45, weekdays: [] };
    case "lunch":
      return { start: round5(690 + ((index * 15) % 120)), duration: 30, weekdays: [] };
    case "tea":
      return { start: round5(990 + ((index * 15) % 105)), duration: heavy ? 45 : 30, weekdays: [] };
    case "bed":
      return { start: round5(1200 + ((index * 10) % 90)), duration: heavy ? 45 : 30, weekdays: [] };
    case "social":
      return { start: 600, duration: 90, weekdays: [2, 4, 6] };
  }
}

export function buildDemoRoster(opts: BuildOptions): DemoRoster {
  const rand = mulberry32((opts.seed ?? 20261011) + Number(opts.today.replaceAll("-", "")));
  const { orgId, today } = opts;
  const CARERS = expandCarers(opts.scale ?? 0);
  const CLIENTS = expandClients(opts.scale ? Math.round(opts.scale * 0.75) : 0);
  const windowEnd = dayOffset(today, WINDOW_DAYS - 1);
  const id = () => crypto.randomUUID();
  const jitter = () => (rand() - 0.5) * 0.012;

  // ── people ──
  const carerIds = new Map(CARERS.map((c) => [c.key, id()]));
  const clientIds = new Map(CLIENTS.map((c) => [c.key, id()]));
  const carerLoc = new Map<string, { lat: number; lng: number }>();
  const clientLoc = new Map<string, { lat: number; lng: number }>();

  const carers: Row[] = CARERS.map((c, i) => {
    const a = AREAS[c.area];
    const loc = { lat: Math.round((a.lat + jitter()) * 1e5) / 1e5, lng: Math.round((a.lng + jitter()) * 1e5) / 1e5 };
    carerLoc.set(c.key, loc);
    const [first, ...rest] = c.name.split(" ");
    const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const availability = Object.fromEntries(
      Object.entries(PATTERNS[c.pattern]).map(([wd, windows]) => [dayKeys[Number(wd) - 1], (windows ?? []).map(([start, end]) => ({ start, end }))]),
    );
    return {
      id: carerIds.get(c.key),
      org_id: orgId,
      full_name: c.name,
      email: `${slug(first)}.${slug(rest.join(""))}@roster-demo.test`,
      phone: `07700 900${pad(100 + i)}`,
      role: c.role,
      status: "active",
      is_available: true,
      gender: c.gender,
      start_date: dayOffset(today, -(200 + i * 40)),
      notes: `${DEMO_TAG} ${c.note}`,
      address: `${10 + i} ${STREETS[i % STREETS.length]}, ${a.label}, Leicester`,
      postcode: `${a.postcode}${String.fromCharCode(65 + ((i * 3) % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}`,
      ...loc,
      skills: c.skills,
      languages: c.languages,
      transport_mode: c.transport,
      max_weekly_hours: c.maxWeeklyHours,
      contract_hours: Math.min(c.maxWeeklyHours, 37.5),
      employment_type: c.maxWeeklyHours <= 25 ? "zero_hours" : "permanent",
      driving_licence: c.transport === "car",
      has_vehicle: c.transport === "car",
      is_smoker: !!c.smoker,
      pet_allergies: c.petAllergies ?? [],
      availability,
    };
  });

  const clients: Row[] = CLIENTS.map((c, i) => {
    const a = AREAS[c.area];
    const loc = { lat: Math.round((a.lat + jitter()) * 1e5) / 1e5, lng: Math.round((a.lng + jitter()) * 1e5) / 1e5 };
    clientLoc.set(c.key, loc);
    return {
      id: clientIds.get(c.key),
      org_id: orgId,
      full_name: c.name,
      dob: `${1930 + ((i * 3) % 22)}-${pad(1 + ((i * 5) % 12))}-${pad(1 + ((i * 7) % 28))}`,
      address: `${3 + i * 2} ${STREETS[(i + 4) % STREETS.length]}, ${a.label}, Leicester`,
      postcode: `${a.postcode}${String.fromCharCode(65 + ((i * 5) % 26))}${String.fromCharCode(65 + ((i * 11) % 26))}`,
      ...loc,
      gender: c.gender,
      primary_language: c.language,
      interpreter_needed: c.language !== "English" && ["Polish", "Gujarati"].includes(c.language),
      allergies: c.allergies ?? [],
      pets: c.pets ?? [],
      preferred_carer_gender: c.genderPref ?? null,
      carer_gender_required: !!c.genderRequired,
      prefers_non_smoking_carer: !!c.nonSmoker,
      mobility_level: c.mobility ?? "independent",
      status: "active",
      consent_to_care: true,
      capacity_status: "has_capacity",
      emergency_contact_name: "Family contact",
      emergency_contact_phone: `07700 900${pad(300 + i)}`,
      care_notes: `${DEMO_TAG} ${c.note}`.trim(),
    };
  });

  const preferences: Row[] = CLIENTS.flatMap((c) => [
    ...(c.preferred ?? []).map((k) => ({ org_id: orgId, client_id: clientIds.get(c.key), carer_id: carerIds.get(k), kind: "preferred", reason: null })),
    ...(c.excluded ?? []).map((e) => ({ org_id: orgId, client_id: clientIds.get(c.key), carer_id: carerIds.get(e.key), kind: "excluded", reason: e.reason })),
  ]);
  const prefOf = (clientKey: string, carerKey: string): "preferred" | "excluded" | null => {
    const c = CLIENTS.find((x) => x.key === clientKey)!;
    if (c.excluded?.some((e) => e.key === carerKey)) return "excluded";
    if (c.preferred?.includes(carerKey)) return "preferred";
    return null;
  };

  // ── leave and unavailability: these are what leave gaps in the roster ──
  const leave = [
    { key: "james", type: "holiday", from: 3, to: 6, status: "approved", reason: "Family holiday" },
    { key: "priya", type: "holiday", from: 8, to: 10, status: "approved", reason: "Exam revision" },
    { key: "lucy", type: "sick_leave", from: -1, to: 1, status: "approved", reason: "Flu" },
    { key: "kamal", type: "holiday", from: 10, to: 11, status: "pending", reason: "Wedding" },
  ];
  const absences: Row[] = leave.map((l) => ({
    org_id: orgId,
    carer_id: carerIds.get(l.key),
    absence_type: l.type,
    start_date: dayOffset(today, l.from),
    end_date: dayOffset(today, l.to),
    status: l.status,
    reason: `${DEMO_TAG} ${l.reason}`,
    approved_at: l.status === "approved" ? opts.now.toISOString() : null,
  }));

  const blocks = [
    { key: "emily", day: 2, start: "14:00", end: "18:00", reason: "School play" },
    { key: "daniel", day: 5, start: "08:00", end: "12:00", reason: "Hospital appointment" },
    { key: "aisha", day: 1, start: "15:00", end: "19:30", reason: "Parents' evening" },
  ];
  const wall = (date: string, time: string) => {
    const [h, m] = time.split(":").map(Number);
    return londonWallClockToInstant(parseCalendarDate(date), h, m);
  };
  const unavailability: Row[] = blocks.map((b) => ({
    org_id: orgId,
    carer_id: carerIds.get(b.key),
    starts_at: wall(dayOffset(today, b.day), b.start).toISOString(),
    ends_at: wall(dayOffset(today, b.day), b.end).toISOString(),
    reason: `${DEMO_TAG} ${b.reason}`,
    created_by: opts.adminId,
  }));

  // ── series and visits (the same planner the API uses) ──
  interface SeriesInfo {
    client: DemoClient;
    kind: CallKind;
    plan: RosterPlan;
    inserts: ShiftInsert[];
    regular: string[]; // carer keys, lead first
    required: number;
  }
  const seriesList: SeriesInfo[] = [];
  CLIENTS.forEach((client, ci) => {
    client.calls.forEach((kind) => {
      const spec = callSpec(kind, ci, client);
      const required = client.doubleUp?.includes(kind) ? 2 : 1;
      const end = hhmm(spec.start + spec.duration);
      const { plan } = planCreate(
        {
          client_id: clientIds.get(client.key)!,
          date: today,
          start_time: hhmm(spec.start),
          end_time: end,
          required_carers: required,
          required_skills: client.skills,
          notes: null,
          roster_state: "draft",
          recurrence: spec.weekdays.length
            ? { frequency: "custom", repeat_every: 1, by_weekday: spec.weekdays, until_date: windowEnd }
            : { frequency: "daily", repeat_every: 1, by_weekday: [], until_date: windowEnd },
        },
        { orgId, adminId: opts.adminId, today },
      );
      // Open-ended in practice: materialised for the window, with no end date.
      const series = plan.series_upserts[0];
      series.until_date = null;
      series.generated_until = windowEnd;
      series.notes = `${DEMO_TAG} ${kind} call`;
      for (const v of plan.shift_inserts) {
        v.roster_state = (v.occurrence_date as string) <= dayOffset(today, PUBLISHED_DAYS - 1) ? "published" : "draft";
      }
      seriesList.push({ client, kind, plan, inserts: plan.shift_inserts, regular: [], required });
    });
  });

  // ── eligibility plumbing ──
  const carerSnap = new Map<string, EligibilityCarer>(
    CARERS.map((c) => [
      c.key,
      {
        id: carerIds.get(c.key)!,
        status: "active",
        is_available: true,
        gender: c.gender,
        skills: c.skills,
        pet_allergies: c.petAllergies ?? [],
        is_smoker: !!c.smoker,
        max_weekly_hours: c.maxWeeklyHours,
        availability: (carers.find((r) => r.id === carerIds.get(c.key)) as Row).availability,
      },
    ]),
  );
  const clientSnap = (c: DemoClient): EligibilityClient => ({
    preferred_carer_gender: c.genderPref ?? null,
    carer_gender_required: !!c.genderRequired,
    prefers_non_smoking_carer: !!c.nonSmoker,
    pets: c.pets ?? [],
  });
  const accepted = new Map<string, { id: string; start_time: string; end_time: string; status: string }[]>(CARERS.map((c) => [c.key, []]));
  const absenceFor = (key: string) =>
    absences.filter((a) => a.carer_id === carerIds.get(key)).map((a) => ({ absence_type: a.absence_type as string, start_date: a.start_date as string, end_date: a.end_date as string, status: a.status as string }));
  const blocksFor = (key: string) =>
    unavailability.filter((b) => b.carer_id === carerIds.get(key)).map((b) => ({ starts_at: b.starts_at as string, ends_at: b.ends_at as string }));

  const check = (carerKey: string, client: DemoClient, v: ShiftInsert) =>
    checkEligibility({
      carer: carerSnap.get(carerKey)!,
      client: clientSnap(client),
      visit: { id: v.id, start_time: v.start_time, end_time: v.end_time, required_skills: v.required_skills },
      preference: prefOf(client.key, carerKey),
      absences: absenceFor(carerKey),
      unavailability: blocksFor(carerKey),
      otherVisits: accepted.get(carerKey) ?? [],
    });

  // ── regular carer per series (continuity): static suitability + proximity + workload ──
  const planned = new Map<string, number>(CARERS.map((c) => [c.key, 0]));
  const visitMinutes = (s: SeriesInfo) => s.plan.series_upserts[0].duration_minutes * s.inserts.length;
  const scoreCarer = (c: DemoCarer, s: SeriesInfo): number | null => {
    const probe = s.inserts[0];
    const e = check(c.key, s.client, { ...probe });
    // Static rules only: ignore overlap / leave / hours here, those are what create gaps later.
    const hard = e.blocked.filter((i) => i.code !== "ON_LEAVE");
    const staticOverridable = e.overridable.filter((i) => i.code === "MISSING_SKILL" || i.code === "PET_ALLERGY");
    if (hard.length || staticOverridable.length) return null;
    const cap = c.maxWeeklyHours * 60 * (WINDOW_DAYS / 7);
    if (planned.get(c.key)! + visitMinutes(s) > cap) return null;
    const dist = distanceKm(carerLoc.get(c.key)!, clientLoc.get(s.client.key)!);
    return (
      (prefOf(s.client.key, c.key) === "preferred" ? 100 : 0) +
      (c.languages.includes(s.client.language) && s.client.language !== "English" ? 40 : 0) +
      (s.client.genderPref && c.gender.toLowerCase() === s.client.genderPref ? 15 : 0) +
      (s.client.nonSmoker && !c.smoker ? 10 : 0) -
      dist * 4 -
      (planned.get(c.key)! / cap) * 40
    );
  };
  for (const s of seriesList) {
    const ranked = CARERS.map((c) => ({ c, score: scoreCarer(c, s) }))
      .filter((x): x is { c: DemoCarer; score: number } => x.score !== null)
      .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
    s.regular = ranked.slice(0, s.required).map((x) => x.c.key);
    for (const key of s.regular) planned.set(key, planned.get(key)! + visitMinutes(s));
    s.plan.series_upserts[0].default_carer_ids = s.regular.map((k) => carerIds.get(k)!);
  }

  // ── assign visit by visit, in time order, with the real eligibility rules ──
  // Ids are random (so two orgs never collide), so ties at the same start time are broken by a
  // stable creation index instead; that keeps the whole build reproducible.
  interface Slot { s: SeriesInfo; v: ShiftInsert; n: number }
  const slots: Slot[] = seriesList.flatMap((s) => s.inserts.map((v) => ({ s, v, n: 0 })));
  slots.forEach((x, n) => (x.n = n));
  slots.sort((a, b) => a.v.start_time.localeCompare(b.v.start_time) || a.n - b.n);

  // A few visits nobody could cover, in the published week where the coordinator would see them.
  const nearTerm = slots.filter((x) => x.v.occurrence_date! > today && x.v.occurrence_date! <= dayOffset(today, PUBLISHED_DAYS - 1));
  const noCover = new Set<string>();
  while (noCover.size < 6 && nearTerm.length) noCover.add(nearTerm[Math.floor(rand() * nearTerm.length)].v.id);

  const assigned = new Map<string, string[]>(); // visit id -> carer keys (lead first)
  for (const { s, v } of slots) {
    const picked: string[] = [];
    const want = s.client.halfStaffed?.includes(s.kind) ? 1 : s.required;
    if (!noCover.has(v.id)) {
      for (let slot = 0; slot < want; slot++) {
        const regular = s.regular[slot];
        let chosen: string | null = null;
        if (regular && !picked.includes(regular) && canAssign(check(regular, s.client, v), false)) chosen = regular;
        else if (rand() < CHANCE_OF_COVER) {
          // Cover: nearest other carer who passes every rule.
          const cover = CARERS.filter((c) => !picked.includes(c.key) && !s.regular.includes(c.key))
            .map((c) => ({ c, d: distanceKm(carerLoc.get(c.key)!, clientLoc.get(s.client.key)!) }))
            .sort((a, b) => a.d - b.d)
            .find((x) => canAssign(check(x.c.key, s.client, v), false));
          if (cover) chosen = cover.c.key;
        }
        if (!chosen) continue;
        picked.push(chosen);
        accepted.get(chosen)!.push({ id: v.id, start_time: v.start_time, end_time: v.end_time, status: "assigned" });
      }
    }
    assigned.set(v.id, picked);
    // A few visit notes a coordinator would really write.
    if (rand() < 0.06) v.notes = ["Key safe code is in the care plan", "Dog is friendly; please close the gate", "Ring the bell twice; client is hard of hearing"][Math.floor(rand() * 3)];
    for (const key of picked) {
      s.plan.assignment_adds.push({ shift_id: v.id, carer_id: carerIds.get(key)!, assigned_by: opts.adminId });
    }
  }

  // ── today's progress and tomorrow's confirmations ──
  const updates: DemoRoster["updates"] = { completed: [], inProgress: [], confirmed: [] };
  const tomorrow = dayOffset(today, 1);
  for (const { s, v } of slots) {
    const staffed = (assigned.get(v.id)?.length ?? 0) >= s.required;
    const lead = assigned.get(v.id)?.length ?? 0;
    if (v.occurrence_date === today && lead > 0) {
      const start = new Date(v.start_time).getTime();
      const end = new Date(v.end_time).getTime();
      if (end <= opts.now.getTime()) {
        const late = rand() < 0.15 ? 20 : Math.floor(rand() * 8);
        const short = rand() < 0.1 ? 12 : Math.floor(rand() * 5);
        const actualStart = start + late * 60_000;
        // Always end after the start (the shifts table has a CHECK for it), even for a short visit.
        const actualEnd = Math.max(end - short * 60_000, actualStart + 10 * 60_000);
        updates.completed.push({ id: v.id, actual_start: new Date(actualStart).toISOString(), actual_end: new Date(actualEnd).toISOString() });
      } else if (start <= opts.now.getTime()) {
        updates.inProgress.push({ id: v.id, actual_start: new Date(start + Math.floor(rand() * 6) * 60_000).toISOString() });
      }
    }
    if (v.occurrence_date === tomorrow && staffed && rand() < 0.5) updates.confirmed.push(v.id);
  }

  // ── stats ──
  const allInserts = seriesList.flatMap((s) => s.inserts);
  let conflicts = 0;
  for (const list of accepted.values()) {
    const sorted = [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < sorted.length; i++) if (sorted[i].start_time < sorted[i - 1].end_time) conflicts++;
  }
  const doubleUps = slots.filter((x) => x.s.required === 2);
  const staffedCount = (x: Slot) => assigned.get(x.v.id)?.length ?? 0;
  const stats: Stats = {
    carers: carers.length,
    clients: clients.length,
    series: seriesList.length,
    visits: allInserts.length,
    assignedVisits: slots.filter((x) => staffedCount(x) >= x.s.required).length,
    unassignedVisits: slots.filter((x) => staffedCount(x) < x.s.required).length,
    doubleUpVisits: doubleUps.length,
    fullyStaffedDoubleUps: doubleUps.filter((x) => staffedCount(x) === 2).length,
    halfStaffedDoubleUps: doubleUps.filter((x) => staffedCount(x) === 1).length,
    published: allInserts.filter((v) => v.roster_state === "published").length,
    draft: allInserts.filter((v) => v.roster_state === "draft").length,
    completed: updates.completed.length,
    inProgress: updates.inProgress.length,
    confirmed: updates.confirmed.length,
    conflicts,
  };

  return {
    carers, clients, preferences, absences, unavailability,
    plans: seriesList.map((s) => ({ ...emptyPlan(), ...s.plan })),
    updates, stats,
  };
}
