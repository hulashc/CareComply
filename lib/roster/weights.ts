// Org-level matching weights. Only overrides are stored (roster_settings.weights); the defaults
// live here so a new weight in a later phase needs no migration, and orgs that never customised
// pick up improved defaults. Phase 1 stores and serves the weights; scoring is a later phase.

/** Relative importance, each 0-100. They do not need to sum to 100 (scores are normalised later). */
export const DEFAULT_WEIGHTS = {
  continuity: 25, // same carer as the client's usual / previous visits
  preferred_carer: 20, // on the client's preferred list
  travel: 20, // short travel from the previous visit / home
  language: 10, // shares the client's language
  gender_preference: 10, // matches the client's preferred carer gender
  workload_balance: 10, // spreads hours fairly against contracted hours
  smoker_preference: 5, // respects a non-smoking preference
} as const;

export type WeightKey = keyof typeof DEFAULT_WEIGHTS;
export type MatchingWeights = Record<WeightKey, number>;

export const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as WeightKey[];

const isValidWeight = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

/** Defaults overlaid with valid stored overrides. Unknown keys and bad values are ignored. */
export function resolveWeights(stored: unknown): MatchingWeights {
  const out: MatchingWeights = { ...DEFAULT_WEIGHTS };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const key of WEIGHT_KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (isValidWeight(value)) out[key] = value;
    }
  }
  return out;
}

/** The overrides to persist: only values that differ from the defaults. */
export function overridesOf(weights: MatchingWeights): Partial<MatchingWeights> {
  const out: Partial<MatchingWeights> = {};
  for (const key of WEIGHT_KEYS) if (weights[key] !== DEFAULT_WEIGHTS[key]) out[key] = weights[key];
  return out;
}
