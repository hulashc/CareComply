import type { PlanVisit, VisitStatus } from "./types";

// Visit status rules. assigned / unassigned / confirmed follow staffing and are derived by a
// database trigger (migration 023) so every writer agrees; this module mirrors that logic for
// previews and for validating admin-requested transitions before they reach the database.

export function deriveStatus(
  current: VisitStatus | "scheduled",
  assignedCarers: number,
  requiredCarers: number,
): VisitStatus {
  if (current === "in_progress" || current === "completed" || current === "cancelled") return current;
  if (assignedCarers < requiredCarers) return "unassigned";
  return current === "confirmed" ? "confirmed" : "assigned";
}

// Explicit states an admin may request. "assigned" means "reopen / unconfirm": the database
// derives the real value (assigned or unassigned) from staffing. "unassigned" is never set directly.
const TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  unassigned: ["cancelled", "assigned"],
  assigned: ["confirmed", "in_progress", "completed", "cancelled"],
  confirmed: ["assigned", "in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: ["assigned"],
};

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export function canSetStatus(from: VisitStatus, to: VisitStatus): TransitionResult {
  if (from === to) return { ok: true };
  if (to === "unassigned") return { ok: false, reason: "Status 'unassigned' is derived from staffing and cannot be set" };
  if (TRANSITIONS[from].includes(to)) return { ok: true };
  return { ok: false, reason: `A ${from.replace("_", " ")} visit cannot be changed to ${to.replace("_", " ")}` };
}

/** Started visits (checked in, in progress or done) are never rescheduled or deleted. */
export function isStarted(v: Pick<PlanVisit, "status" | "actual_start">): boolean {
  return v.actual_start != null || v.status === "in_progress" || v.status === "completed";
}
