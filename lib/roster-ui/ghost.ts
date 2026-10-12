import type { ScoredCandidate } from "../roster/matching/types";
import type { WeightKey } from "../roster/weights";
import type { CarerScore } from "../roster/matching-service";

// Shapes and pure helpers for the matching panel and the drag "ghost score" heat map.
// (CarerScore is a type-only import: matching-service itself never reaches the browser.)

export type { CarerScore };

export interface ScoreMap {
  visit_id: string;
  start_time: string;
  end_time: string;
  scores: Record<string, CarerScore>;
}

export interface SuggestionsResponse {
  visit_id: string;
  open_slots: number;
  weights: Record<string, number>;
  candidates: ScoredCandidate[];
  excluded_count: number;
  excluded: { carer_id: string; full_name: string; short: string; message: string }[];
}

export const scoreKey = (visitId: string, startIso: string, endIso: string, fromCarer: string | null) =>
  `score:${visitId}|${new Date(startIso).getTime()}|${new Date(endIso).getTime()}|${fromCarer ?? ""}`;

/** Red (0) → amber (50) → green (100). Hue 0-130, so it reads in light and dark themes. */
export function heatColor(total: number, alpha = 0.28): string {
  const t = Math.min(100, Math.max(0, total));
  return `hsl(${Math.round((t / 100) * 130)} 75% 45% / ${alpha})`;
}

/** Display form for a match score: "82%". */
export const pct = (total: number) => `${Math.round(total)}%`;

export const FACTOR_LABELS: Record<WeightKey, string> = {
  continuity: "Continuity",
  preferred_carer: "Preferred carer",
  travel: "Travel",
  language: "Language",
  gender_preference: "Gender preference",
  workload_balance: "Workload balance",
  smoker_preference: "Non-smoker",
  pet_allergy: "Pet allergy",
  availability_fit: "Availability fit",
  skills_experience: "Skills & experience",
  transport: "Transport",
};
