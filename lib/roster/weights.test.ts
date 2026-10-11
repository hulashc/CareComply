import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, overridesOf, resolveWeights } from "./weights";
import { settingsSchema } from "./schemas";

describe("matching weights", () => {
  it("defaults sum to 100", () => {
    expect(Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("an org with no overrides gets the defaults", () => {
    expect(resolveWeights({})).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights(null)).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights([1, 2])).toEqual(DEFAULT_WEIGHTS);
  });

  it("overlays valid overrides and ignores unknown keys and bad values", () => {
    const w = resolveWeights({ travel: 40, continuity: -5, language: "high", nonsense: 9, preferred_carer: 100 });
    expect(w.travel).toBe(40);
    expect(w.preferred_carer).toBe(100);
    expect(w.continuity).toBe(DEFAULT_WEIGHTS.continuity); // negative ignored
    expect(w.language).toBe(DEFAULT_WEIGHTS.language); // non-number ignored
    expect("nonsense" in w).toBe(false);
  });

  it("stores only what differs from the defaults", () => {
    expect(overridesOf(resolveWeights({ travel: 40, language: DEFAULT_WEIGHTS.language }))).toEqual({ travel: 40 });
    expect(overridesOf(resolveWeights({}))).toEqual({});
  });

  it("validates updates: known keys, 0-100", () => {
    expect(settingsSchema.safeParse({ weights: { travel: 30 } }).success).toBe(true);
    expect(settingsSchema.safeParse({ weights: { travel: 101 } }).success).toBe(false);
    expect(settingsSchema.safeParse({ weights: { bogus: 1 } }).success).toBe(false);
    expect(settingsSchema.safeParse({ reset: true }).success).toBe(true);
    expect(settingsSchema.safeParse({}).success).toBe(false);
  });
});
