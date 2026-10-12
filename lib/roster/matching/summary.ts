import type { IssueCode } from "../eligibility";
import type { ExcludedCandidate, ScoredCandidate } from "./types";

// Short, UI-sized labels for the matching engine's output (heat map tooltips, greyed-out carers).

const SHORT_REASON: Record<IssueCode | "ALREADY_ASSIGNED", string> = {
  EXCLUDED_CARER: "Do not pair",
  CARER_INACTIVE: "Inactive",
  SAME_PERSON: "Same person as client",
  ON_LEAVE: "On leave",
  GENDER_REQUIRED: "Gender required",
  OVERLAP: "Overlaps another visit",
  UNAVAILABLE: "Unavailable",
  MISSING_SKILL: "Missing skill",
  PET_ALLERGY: "Pet allergy",
  OVER_WEEKLY_HOURS: "Over weekly hours",
  OUTSIDE_WORKING_HOURS: "Outside working hours",
  LEAVE_PENDING: "Leave pending",
  PREFERS_NON_SMOKER: "Prefers non-smoker",
  GENDER_PREFERENCE: "Gender preference",
  ALREADY_ASSIGNED: "Already assigned",
};

export function shortReason(code: IssueCode | "ALREADY_ASSIGNED"): string {
  return SHORT_REASON[code] ?? "Not available";
}

/** The most relevant reason a carer was filtered out: the first issue, in the engine's order. */
export function excludedReason(e: ExcludedCandidate): { short: string; message: string } {
  const first = e.issues[0];
  return first ? { short: shortReason(first.code), message: first.message } : { short: "Not available", message: "Not available" };
}

/** One line for a tooltip: the first reason, else the first warning, else nothing. */
export function topReason(s: Pick<ScoredCandidate, "reasons" | "warnings">): string | null {
  return s.reasons[0] ?? s.warnings[0] ?? null;
}
