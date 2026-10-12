import { londonDateOf } from "../../dates/london";
import { fitsWorkingHours, normaliseGender, parseWorkingHours, weekKey } from "../eligibility";
import type { TransportMode } from "../types";
import type { WeightKey } from "../weights";
import { withFallback, type LatLng } from "./distance";
import type { Candidate, CarerVisit, FactorResult, MatchInput } from "./types";

// The Stage B factors. Each returns a value in 0..1 (or null = does not apply to this client)
// plus human-readable reasons and warnings. The formulas are documented in engine.ts.

const DAY_MS = 86_400_000;
export const CONTINUITY_LOOKBACK_DAYS = 90;
export const CONTINUITY_RECENT_DAYS = 28;
/** Travel at or above this many minutes per leg scores 0. */
export const TRAVEL_ZERO_MINUTES = 45;
/** Gaps up to this are ideal; the contiguity score reaches 0 at CONTIGUITY_ZERO_GAP. */
export const CONTIGUITY_IDEAL_GAP = 30;
export const CONTIGUITY_ZERO_GAP = 180;
/** A leg longer than this needs a vehicle. */
export const DRIVING_NEEDED_KM = 2;
/** Warn when the visit leaves less than this many hours under max weekly hours. */
export const HOURS_HEADROOM_WARNING = 2;

const NEUTRAL = 0.5;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const ms = (iso: string) => new Date(iso).getTime();
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const point = (lat: number | null | undefined, lng: number | null | undefined): LatLng | null =>
  lat != null && lng != null ? { lat, lng } : null;

// ── The carer's day around this visit (shared by travel, availability, transport) ──

export interface Leg {
  label: "home" | "previous visit" | "next visit";
  km: number;
  minutes: number;
}

export interface DayPlan {
  prev: CarerVisit | null;
  next: CarerVisit | null;
  gapBefore: number | null;
  gapAfter: number | null;
  legs: Leg[];
  /** Average minutes per leg; null when no leg could be measured. */
  travelMinutes: number | null;
}

export function drives(c: Candidate): boolean {
  return c.carer.transport_mode === "car" || (c.carer.driving_licence && c.carer.has_vehicle);
}

function effectiveMode(c: Candidate): TransportMode | null {
  return c.carer.transport_mode ?? (drives(c) ? "car" : null);
}

export function planDay(input: MatchInput, c: Candidate): DayPlan {
  const { visit, client } = input;
  const start = ms(visit.start_time);
  const end = ms(visit.end_time);
  const day = londonDateOf(new Date(start));
  const sameDay = c.otherVisits.filter(
    (o) => o.id !== visit.id && o.status !== "cancelled" && londonDateOf(new Date(o.start_time)) === day,
  );
  const prev = sameDay.filter((o) => ms(o.end_time) <= start).sort((a, b) => ms(b.end_time) - ms(a.end_time) || (a.id < b.id ? -1 : 1))[0] ?? null;
  const next = sameDay.filter((o) => ms(o.start_time) >= end).sort((a, b) => ms(a.start_time) - ms(b.start_time) || (a.id < b.id ? -1 : 1))[0] ?? null;

  const legs: Leg[] = [];
  const here = point(client.lat, client.lng);
  if (here) {
    const distance = withFallback(input.distance);
    const mode = effectiveMode(c);
    const origin = prev ? point(prev.lat, prev.lng) : point(c.carer.lat, c.carer.lng);
    if (origin) legs.push({ label: prev ? "previous visit" : "home", ...distance.estimate(origin, here, mode)! });
    const onward = next ? point(next.lat, next.lng) : null;
    if (onward) legs.push({ label: "next visit", ...distance.estimate(here, onward, mode)! });
  }

  return {
    prev,
    next,
    gapBefore: prev ? (start - ms(prev.end_time)) / 60_000 : null,
    gapAfter: next ? (ms(next.start_time) - end) / 60_000 : null,
    legs,
    travelMinutes: legs.length ? legs.reduce((s, l) => s + l.minutes, 0) / legs.length : null,
  };
}

// ── Factors ──────────────────────────────────────────────────────────────────

interface Ctx {
  input: MatchInput;
  c: Candidate;
  day: DayPlan;
}

const result = (value: number | null, reasons: string[] = [], warnings: string[] = []): FactorResult => ({ value, reasons, warnings });
const clientName = (input: MatchInput) => input.client.display_name || input.client.full_name || "this client";

function continuity({ input, c }: Ctx): FactorResult {
  const ref = ms(input.visit.start_time);
  const past = c.history.filter((h) => h.status !== "cancelled" && ms(h.start_time) < ref && ms(h.start_time) >= ref - CONTINUITY_LOOKBACK_DAYS * DAY_MS);
  const n = past.length;
  const r = past.filter((h) => ms(h.start_time) >= ref - CONTINUITY_RECENT_DAYS * DAY_MS).length;
  const reasons: string[] = [];
  const keyWorker = input.client.key_worker_id === c.carer.id;
  if (keyWorker) reasons.push("Key worker");
  if (n > 0) reasons.push(`Visited ${clientName(input)} ${n === 1 ? "once" : `${n} times`}`);
  return result(keyWorker ? 1 : 0.7 * Math.min(n / 10, 1) + 0.3 * Math.min(r / 4, 1), reasons);
}

function preferredCarer({ input, c }: Ctx): FactorResult {
  if (!input.client.has_preferred_carers) return result(null);
  return c.preference === "preferred" ? result(1, [`On ${clientName(input)}'s preferred list`]) : result(0);
}

function language({ input, c }: Ctx): FactorResult {
  const wanted = input.client.primary_language?.trim();
  if (!wanted) return result(null);
  const match = c.carer.languages.find((l) => same(l, wanted));
  return match ? result(1, [`Speaks ${match}`]) : result(0);
}

function genderPreference({ input, c }: Ctx): FactorResult {
  const wanted = normaliseGender(input.client.preferred_carer_gender);
  if (!wanted) return result(null);
  return result(normaliseGender(c.carer.gender) === wanted ? 1 : 0);
}

function smokerPreference({ input, c }: Ctx): FactorResult {
  if (!input.client.prefers_non_smoking_carer) return result(null);
  return c.carer.is_smoker ? result(0, [], ["Smoker; client prefers a non-smoking carer"]) : result(1);
}

function petAllergy({ input, c }: Ctx): FactorResult {
  if (input.client.pets.length === 0) return result(null);
  const clash = c.carer.pet_allergies.filter((a) => input.client.pets.some((p) => same(p, a)));
  return clash.length ? result(0, [], [`Allergic to the client's ${clash.join(", ")}`]) : result(1);
}

function travel({ day }: Ctx): FactorResult {
  if (day.travelMinutes === null) return result(NEUTRAL);
  const first = day.legs[0];
  const reasons = [first.label === "next visit" ? `${Math.round(first.minutes)} min to next visit` : `${Math.round(first.minutes)} min from ${first.label}`];
  const warnings: string[] = [];
  for (const leg of day.legs) {
    const gap = leg.label === "next visit" ? day.gapAfter : leg.label === "previous visit" ? day.gapBefore : null;
    if (gap !== null && gap < leg.minutes) warnings.push(`Only ${Math.round(gap)} min between visits but ${Math.round(leg.minutes)} min travel`);
  }
  return result(clamp01(1 - day.travelMinutes / TRAVEL_ZERO_MINUTES), reasons, warnings);
}

function availabilityFit({ input, c, day }: Ctx): FactorResult {
  const hours = parseWorkingHours(c.carer.availability);
  const warnings: string[] = [];
  let within = 0.7; // no pattern recorded = unrestricted, but unconfirmed
  if (hours) {
    within = fitsWorkingHours(hours, new Date(input.visit.start_time), new Date(input.visit.end_time)) ? 1 : 0;
    if (within === 0) warnings.push("Outside the carer's usual working hours");
  }
  const gaps = [day.gapBefore, day.gapAfter].filter((g): g is number => g !== null);
  const gap = gaps.length ? Math.min(...gaps) : null;
  const contiguity = gap === null
    ? NEUTRAL
    : clamp01(1 - (gap - CONTIGUITY_IDEAL_GAP) / (CONTIGUITY_ZERO_GAP - CONTIGUITY_IDEAL_GAP));
  return result(0.5 * within + 0.5 * contiguity, [], warnings);
}

function workloadBalance({ input, c }: Ctx): FactorResult {
  const { visit } = input;
  const week = weekKey(visit.start_time);
  const before = c.otherVisits
    .filter((o) => o.id !== visit.id && o.status !== "cancelled" && weekKey(o.start_time) === week)
    .reduce((s, o) => s + (ms(o.end_time) - ms(o.start_time)) / 3_600_000, 0);
  const after = before + (ms(visit.end_time) - ms(visit.start_time)) / 3_600_000;
  const { contract_hours: contract, max_weekly_hours: max } = c.carer;

  const warnings: string[] = [];
  if (contract != null && after > contract) warnings.push(`Would reach ${round1(after)}h this week (contract ${contract}h)`);
  if (max != null && after <= max && max - after <= HOURS_HEADROOM_WARNING) warnings.push(`Would reach ${round1(after)}h this week (max ${max}h)`);

  const target = contract ?? max;
  if (target == null || target <= 0) return result(NEUTRAL, [], warnings);
  return result(after > target ? 0 : clamp01(1 - before / target), [], warnings);
}

function skillsExperience({ input, c }: Ctx): FactorResult {
  const required = new Set(input.visit.required_skills);
  const extra = new Set(c.carer.skills.filter((s) => !required.has(s))).size;
  const parts = [Math.min(extra / 5, 1)];
  const reasons: string[] = [];

  const started = c.carer.start_date ? Date.parse(`${c.carer.start_date}T00:00:00Z`) : NaN;
  if (Number.isFinite(started)) {
    const years = Math.max(0, (ms(input.visit.start_time) - started) / (365.25 * DAY_MS));
    parts.push(Math.min(years / 3, 1));
    const whole = Math.floor(years);
    if (whole >= 1) reasons.push(whole === 1 ? "1 year's experience" : `${whole} years' experience`);
  }
  const rating = c.carer.rating;
  if (typeof rating === "number" && rating >= 1 && rating <= 5) parts.push((rating - 1) / 4);

  return result(parts.reduce((a, b) => a + b, 0) / parts.length, reasons);
}

function transport({ c, day }: Ctx): FactorResult {
  const needed = day.legs.some((l) => l.km > DRIVING_NEEDED_KM);
  if (!needed) return result(1);
  if (drives(c)) return result(1, ["Drives"]);
  const mode = c.carer.transport_mode;
  return result(mode === "walking" ? 0 : mode ? 0.5 : 0.3);
}

/** Evaluation order is also the order reasons and warnings are listed in. */
export const FACTORS: [WeightKey, (ctx: Ctx) => FactorResult][] = [
  ["continuity", continuity],
  ["travel", travel],
  ["preferred_carer", preferredCarer],
  ["language", language],
  ["gender_preference", genderPreference],
  ["smoker_preference", smokerPreference],
  ["pet_allergy", petAllergy],
  ["availability_fit", availabilityFit],
  ["workload_balance", workloadBalance],
  ["skills_experience", skillsExperience],
  ["transport", transport],
];

export function evaluateFactors(input: MatchInput, c: Candidate, day: DayPlan = planDay(input, c)): Record<WeightKey, FactorResult> {
  const ctx = { input, c, day };
  return Object.fromEntries(FACTORS.map(([key, fn]) => [key, fn(ctx)])) as Record<WeightKey, FactorResult>;
}
