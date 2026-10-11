import type { VisitRow, VisitStatus } from "../roster/types";

// Shapes the roster calendar reads from /api/roster/*. Read-only in Phase 2.

export type { VisitRow, VisitStatus };

export interface RosterCarer {
  carer_id: string;
  full_name: string;
  status: string | null;
  is_available: boolean | null;
  /** Weekly pattern, {mon:[{start,end}],...}; empty means unrestricted. */
  working_hours?: unknown;
  max_weekly_hours: number | null;
  contract_hours: number | null;
  location_id: string | null;
  /** Team / area: the carer's branch (location) name. */
  team: string | null;
  skills: string[];
  gender: string | null;
  absences: { id: string; absence_type: string; start_date: string; end_date: string; status: string; reason: string | null }[];
  unavailability: { id: string; starts_at: string; ends_at: string; reason: string | null }[];
}

export interface RosterClient {
  id: string;
  full_name: string;
  location_id: string | null;
  team: string | null;
  postcode: string | null;
}

export const VIEWS = ["day", "week", "month", "timeline", "client"] as const;
export type RosterView = (typeof VIEWS)[number];

export const VISIT_TYPES = ["morning", "lunch", "tea", "evening", "other"] as const;
export type VisitType = (typeof VISIT_TYPES)[number];
