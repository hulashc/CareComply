import {
  reviewUrgency,
  taskUrgency,
  unassignedUrgency,
  visitStatus,
  type UrgencyLevel,
} from "@/lib/dashboard/shift-logic";
import type {
  BlockResult,
  CarePlanRow,
  ChecklistRow,
  ConflictRow,
  TimeOffRow,
  TimingData,
  VisitRow,
  WeekStats,
} from "@/lib/services/dashboard-service";
import type { QualificationGroup } from "@/lib/dashboard/shift-logic";

/** What a closed pill shows: a count and how urgent it is. */
export type PillTone = "neutral" | "amber" | "red" | "error";

export interface PillSummary {
  /** Omitted when the block failed to load. */
  count?: number;
  tone: PillTone;
}

const FAILED: PillSummary = { tone: "error" };

function toneFrom(levels: UrgencyLevel[]): PillTone {
  if (levels.includes("red")) return "red";
  if (levels.includes("amber")) return "amber";
  return "neutral";
}

export function summariseDiary(result: BlockResult<VisitRow[]>, now: Date): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: toneFrom(result.data.map((v) => visitStatus(v, now).level)) };
}

export function summariseUnassigned(result: BlockResult<VisitRow[]>, now: Date): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: toneFrom(result.data.map((v) => unassignedUrgency(v.start_time, now).level)) };
}

export function summariseConflicts(result: BlockResult<ConflictRow[]>): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: result.total > 0 ? "red" : "neutral" };
}

export function summariseTraining(result: BlockResult<QualificationGroup[]>): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: toneFrom(result.data.map((g) => g.urgency.level)) };
}

export function summariseTimeOff(result: BlockResult<TimeOffRow[]>): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: result.total > 0 ? "amber" : "neutral" };
}

export function summariseWeek(result: BlockResult<WeekStats>): PillSummary {
  if (!result.ok) return FAILED;
  const { missed, openIncidents } = result.data;
  return { count: result.total, tone: missed > 0 || openIncidents > 0 ? "red" : "neutral" };
}

export function summariseActualTimes(result: BlockResult<TimingData>): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: toneFrom(result.data.flagged.map((f) => f.timing.urgency.level)) };
}

export function summariseCarePlans(result: BlockResult<CarePlanRow[]>, today: string): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: toneFrom(result.data.map((p) => reviewUrgency(p.reviewDate, today).level)) };
}

export function summariseChecklists(result: BlockResult<ChecklistRow[]>, today: string): PillSummary {
  if (!result.ok) return FAILED;
  return { count: result.total, tone: toneFrom(result.data.map((t) => taskUrgency(t.dueDate, today).level)) };
}
