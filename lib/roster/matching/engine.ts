/**
 * Rostering Phase 4: carer matching engine.
 *
 * Pure and deterministic: no database, no clock, no randomness, no LLM. The same MatchInput
 * always gives the same output. lib/roster/matching-service.ts loads the input; the API is
 * GET /api/roster/visits/[id]/suggestions.
 *
 * ── Stage A: hard filters (the candidate is removed) ─────────────────────────
 * Uses checkEligibility (lib/roster/eligibility.ts). Removed when there is any `blocked` issue
 * (do-not-pair EXCLUDED_CARER, ON_LEAVE (approved), CARER_INACTIVE, GENDER_REQUIRED,
 * SAME_PERSON), or one of these overridable issues: MISSING_SKILL, UNAVAILABLE, OVERLAP,
 * OVER_WEEKLY_HOURS. Carers already on the visit are removed as ALREADY_ASSIGNED.
 * PET_ALLERGY, smoking, gender *preference* and working hours only lower the score.
 *
 * ── Stage B: score, 0-100 ────────────────────────────────────────────────────
 *   total = round1( 100 × Σ wᵢ·fᵢ / Σ wᵢ )   over the factors that apply   (0 if Σ wᵢ = 0)
 *
 * fᵢ ∈ [0,1]. wᵢ = the org's weights (roster_settings.weights over DEFAULT_WEIGHTS in
 * lib/roster/weights.ts). A factor does not apply (left out of both sums) only when the
 * client has no such requirement, so every candidate for a visit is scored over the same
 * factors. Missing data about a candidate scores a neutral 0.5 instead.
 *
 *   key                default  fᵢ
 *   continuity            20    key worker → 1, else 0.7·min(n/10,1) + 0.3·min(r/4,1);
 *                               n = non-cancelled visits to the client in the 90 days before,
 *                               r = those in the last 28 days
 *   preferred_carer       10    1 if on the client's preferred list, else 0
 *                               (n/a: the client has no preferred list)
 *   language               8    1 if the carer speaks client.primary_language (n/a: none set)
 *   gender_preference      6    1 if the carer's gender matches (n/a: no preference)
 *   smoker_preference      3    1 if a non-smoker (n/a: the client does not mind)
 *   pet_allergy            3    0 if allergic to one of the client's pets, else 1 (n/a: no pets)
 *   travel                18    t = average minutes per leg [previous visit that day, else
 *                               home] → client, client → [next visit that day];
 *                               clamp(1 − t/45, 0, 1); no measurable leg → 0.5
 *   availability_fit      10    0.5·within + 0.5·contiguity. within: inside working hours 1,
 *                               outside 0, no pattern 0.7. contiguity: nearest gap g to
 *                               another visit that day, 1 at g ≤ 30 min, linear to 0 at
 *                               180 min; no other visit that day → 0.5
 *   workload_balance      10    target = contract_hours ?? max_weekly_hours; 0 if the visit
 *                               takes the week over target, else clamp(1 − hoursBefore/target);
 *                               no target → 0.5
 *   skills_experience      7    mean of: min(extra skills/5, 1); min(years since start_date/3, 1)
 *                               when start_date is known; (rating − 1)/4 when a 1-5 rating exists
 *   transport              5    driving is needed if any leg is over 2 km. Not needed, or the
 *                               carer drives (car, or licence + vehicle) → 1; public transport
 *                               or bicycle → 0.5; walking → 0; unknown → 0.3
 *   (defaults sum to 100)
 *
 * Travel uses a pluggable DistanceService, falling back to haversine × 1.3 at
 * car 30 / public transport 15 / bicycle 14 / walking 5 km/h (distance.ts).
 *
 * ── Order ────────────────────────────────────────────────────────────────────
 * Ties are broken by total desc, then continuity desc, then travel minutes asc (unknown
 * last), then full_name, then carer id (plain code-unit comparison, not locale).
 *
 * Each candidate carries the breakdown (value, weight, points), reasons ("Visited Mrs Patel 14
 * times", "6 min from home", "Speaks Gujarati") and warnings ("Would reach 38h this week
 * (contract 37.5h)", plus pending leave from eligibility).
 */
import { checkEligibility, type Issue, type IssueCode } from "../eligibility";
import { WEIGHT_KEYS, type WeightKey } from "../weights";
import { evaluateFactors, planDay } from "./factors";
import type { Candidate, ExcludedCandidate, FactorScore, MatchInput, ScoredCandidate } from "./types";

export const DEFAULT_SUGGESTIONS = 3;

/** Overridable eligibility issues that still remove a candidate from suggestions. */
const HARD_OVERRIDABLE: ReadonlySet<IssueCode> = new Set(["MISSING_SKILL", "UNAVAILABLE", "OVERLAP", "OVER_WEEKLY_HOURS"]);
/** Eligibility warnings passed through (the others are covered by a factor). */
const PASSED_WARNINGS: ReadonlySet<IssueCode> = new Set(["LEAVE_PENDING"]);

export type MatchIssue = Issue | { code: "ALREADY_ASSIGNED"; message: string };

function eligibilityOf(input: MatchInput, c: Candidate) {
  return checkEligibility({
    carer: c.carer,
    client: input.client,
    visit: input.visit,
    preference: c.preference,
    absences: c.absences,
    unavailability: c.unavailability,
    otherVisits: c.otherVisits,
  });
}

/** Stage A. Empty = the carer stays a candidate. */
export function filterCandidate(input: MatchInput, c: Candidate): MatchIssue[] {
  const issues: MatchIssue[] = [];
  if (input.visit.assigned_carer_ids.includes(c.carer.id)) {
    issues.push({ code: "ALREADY_ASSIGNED", message: "Already assigned to this visit" });
  }
  const e = eligibilityOf(input, c);
  return [...issues, ...e.blocked, ...e.overridable.filter((i) => HARD_OVERRIDABLE.has(i.code))];
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Stage B. Assumes the candidate passed Stage A. */
export function scoreCandidate(input: MatchInput, c: Candidate): ScoredCandidate {
  const day = planDay(input, c);
  const factors = evaluateFactors(input, c, day);
  const weightOf = (k: WeightKey) => Math.max(0, input.weights[k] ?? 0);
  const applicable = WEIGHT_KEYS.filter((k) => factors[k].value !== null);
  const denominator = applicable.reduce((s, k) => s + weightOf(k), 0);
  const points = (k: WeightKey) => (denominator > 0 && factors[k].value !== null ? (100 * weightOf(k) * factors[k].value!) / denominator : 0);

  const breakdown = Object.fromEntries(
    WEIGHT_KEYS.map((k): [WeightKey, FactorScore] => [k, {
      value: factors[k].value === null ? null : round(factors[k].value!, 3),
      weight: weightOf(k),
      points: round(points(k), 1),
      applicable: factors[k].value !== null,
    }]),
  ) as Record<WeightKey, FactorScore>;

  const eligibilityWarnings = eligibilityOf(input, c).warnings.filter((w) => PASSED_WARNINGS.has(w.code)).map((w) => w.message);
  const ordered = Object.values(factors);
  return {
    carer_id: c.carer.id,
    full_name: c.carer.full_name,
    total: round(applicable.reduce((s, k) => s + points(k), 0), 1),
    breakdown,
    reasons: ordered.flatMap((f) => f.reasons),
    warnings: [...eligibilityWarnings, ...ordered.flatMap((f) => f.warnings)],
    travel_minutes: day.travelMinutes === null ? null : round(day.travelMinutes, 1),
  };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  return (
    b.total - a.total ||
    (b.breakdown.continuity?.value ?? 0) - (a.breakdown.continuity?.value ?? 0) ||
    (a.travel_minutes ?? Infinity) - (b.travel_minutes ?? Infinity) ||
    cmp(a.full_name, b.full_name) ||
    cmp(a.carer_id, b.carer_id)
  );
}

export function rankCandidates(input: MatchInput): { candidates: ScoredCandidate[]; excluded: ExcludedCandidate[] } {
  const candidates: ScoredCandidate[] = [];
  const excluded: ExcludedCandidate[] = [];
  for (const c of input.candidates) {
    const issues = filterCandidate(input, c);
    if (issues.length > 0) excluded.push({ carer_id: c.carer.id, full_name: c.carer.full_name, issues });
    else candidates.push(scoreCandidate(input, c));
  }
  excluded.sort((a, b) => cmp(a.full_name, b.full_name) || cmp(a.carer_id, b.carer_id));
  return { candidates: candidates.sort(compareCandidates), excluded };
}

/** The best `limit` (default 3) candidates for the visit, best first. */
export function topCandidates(input: MatchInput, limit = DEFAULT_SUGGESTIONS): ScoredCandidate[] {
  return rankCandidates(input).candidates.slice(0, limit);
}
