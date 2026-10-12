import type { VisitStatus } from "../roster/types";
import { londonParts } from "../dates/london";
import type { VisitType } from "./types";

// One colour language for the whole roster UI. Every style is a light/dark pair with enough
// contrast for text, and status is never conveyed by colour alone (the legend and each block also
// carry the label; drafts have a dashed border).

export interface StatusStyle {
  label: string;
  /** Block / chip classes. */
  block: string;
  /** Legend swatch. */
  dot: string;
}

export const STATUS_STYLES: Record<VisitStatus, StatusStyle> = {
  unassigned: {
    label: "Unassigned",
    block: "bg-red-100 text-red-950 border-red-500 dark:bg-red-950 dark:text-red-50 dark:border-red-400",
    dot: "bg-red-500",
  },
  assigned: {
    label: "Assigned",
    block: "bg-blue-100 text-blue-950 border-blue-500 dark:bg-blue-950 dark:text-blue-50 dark:border-blue-400",
    dot: "bg-blue-500",
  },
  confirmed: {
    label: "Confirmed",
    block: "bg-emerald-100 text-emerald-950 border-emerald-600 dark:bg-emerald-950 dark:text-emerald-50 dark:border-emerald-400",
    dot: "bg-emerald-600",
  },
  in_progress: {
    label: "In progress",
    block: "bg-amber-100 text-amber-950 border-amber-500 dark:bg-amber-950 dark:text-amber-50 dark:border-amber-400",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Completed",
    block: "bg-slate-200 text-slate-800 border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-400",
    dot: "bg-slate-500",
  },
  cancelled: {
    label: "Cancelled",
    block: "bg-zinc-100 text-zinc-600 border-zinc-400 line-through opacity-70 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
    dot: "bg-zinc-400",
  },
};

export const STATUS_ORDER: VisitStatus[] = ["unassigned", "assigned", "confirmed", "in_progress", "completed", "cancelled"];

/** Drafts (not yet published to carers) get a dashed border on top of the status colour. */
export const DRAFT_CLASS = "border-dashed";

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  morning: "Morning",
  lunch: "Lunch",
  tea: "Tea",
  evening: "Evening / bed",
  other: "Other",
};

/**
 * The kind of call, from the London start time. There is no visit-type column; deriving it keeps
 * Phase 2 free of migrations. Morning < 11:00, lunch < 14:00, tea < 18:00, evening after that;
 * calls before 06:00 are "other" (night / early).
 */
export function visitType(startIso: string): VisitType {
  const h = londonParts(new Date(startIso)).hour;
  if (h < 6) return "other";
  if (h < 11) return "morning";
  if (h < 14) return "lunch";
  if (h < 18) return "tea";
  return "evening";
}
