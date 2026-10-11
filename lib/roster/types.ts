// Shared constants and row shapes for the rostering module.
// A "visit" is a row in `shifts` (one client visit); see migration 023 for the data model.

export const VISIT_STATUSES = ["unassigned", "assigned", "confirmed", "in_progress", "completed", "cancelled"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const ROSTER_STATES = ["draft", "published"] as const;
export type RosterState = (typeof ROSTER_STATES)[number];

export const SERIES_FREQUENCIES = ["daily", "weekly", "custom"] as const;
export type SeriesFrequency = (typeof SERIES_FREQUENCIES)[number];

/** Which visits of a recurring series an edit / delete / assign applies to. */
export const SCOPES = ["this", "following", "all"] as const;
export type Scope = (typeof SCOPES)[number];

export const TRANSPORT_MODES = ["car", "public_transport", "bicycle", "walking"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

/** Double-up visits (e.g. hoisting) need two carers; more is out of scope. */
export const MAX_CARERS_PER_VISIT = 2;

/** Open-ended series are materialised this far ahead of today (a roll-forward job is a later phase). */
export const SERIES_HORIZON_DAYS = 84;
export const MAX_OCCURRENCES_PER_REQUEST = 400;
/** Longest date range a list / availability request may span. */
export const MAX_RANGE_DAYS = 62;
export const MAX_BULK_TARGETS = 500;

export interface CarerOnVisit {
  carer_id: string;
  slot: 1 | 2;
  full_name: string;
}

/** A row of the v_roster_visits view. */
export interface VisitRow {
  id: string;
  org_id: string;
  client_id: string;
  client_name: string;
  location_id: string | null;
  start_time: string;
  end_time: string;
  status: VisitStatus;
  roster_state: RosterState;
  published_at: string | null;
  required_carers: number;
  required_skills: string[];
  notes: string | null;
  series_id: string | null;
  occurrence_date: string | null;
  is_series_exception: boolean;
  actual_start: string | null;
  actual_end: string | null;
  created_at: string;
  updated_at: string;
  carers: CarerOnVisit[];
  open_slots: number;
}

/** A row of shift_series, with the time normalised to "HH:mm" (London). */
export interface SeriesRow {
  id: string;
  org_id: string;
  client_id: string;
  location_id: string | null;
  frequency: SeriesFrequency;
  repeat_every: number;
  by_weekday: number[];
  start_date: string;
  until_date: string | null;
  start_time: string;
  duration_minutes: number;
  required_carers: number;
  required_skills: string[];
  default_carer_ids: string[];
  notes: string | null;
  excluded_dates: string[];
  generated_until: string | null;
  created_by: string | null;
}

/** What the planner needs to know about an existing visit. */
export interface PlanVisit {
  id: string;
  client_id: string;
  location_id: string | null;
  start_time: string;
  end_time: string;
  status: VisitStatus;
  roster_state: RosterState;
  series_id: string | null;
  occurrence_date: string | null;
  is_series_exception: boolean;
  actual_start: string | null;
  required_carers: number;
  required_skills: string[];
  notes: string | null;
  /** Assigned carers, lead first. */
  carer_ids: string[];
}

/** The change set sent to the roster_apply_plan RPC; every part is optional there. */
export interface RosterPlan {
  series_upserts: SeriesRow[];
  series_deletes: string[];
  shift_inserts: ShiftInsert[];
  shift_updates: ShiftPatch[];
  shift_deletes: string[];
  assignment_adds: { shift_id: string; carer_id: string; slot?: 1 | 2; assigned_by?: string | null }[];
  assignment_removes: { shift_id: string; carer_id: string }[];
}

export interface ShiftInsert {
  id: string;
  client_id: string;
  location_id: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  required_carers: number;
  required_skills: string[];
  roster_state: RosterState;
  series_id: string | null;
  occurrence_date: string | null;
  is_series_exception?: boolean;
  created_by?: string | null;
}

/** Partial update: only keys present are written. */
export interface ShiftPatch {
  id: string;
  start_time?: string;
  end_time?: string;
  location_id?: string | null;
  notes?: string | null;
  status?: VisitStatus;
  roster_state?: RosterState;
  required_carers?: number;
  required_skills?: string[];
  is_series_exception?: boolean;
  occurrence_date?: string | null;
}

export function emptyPlan(): RosterPlan {
  return {
    series_upserts: [],
    series_deletes: [],
    shift_inserts: [],
    shift_updates: [],
    shift_deletes: [],
    assignment_adds: [],
    assignment_removes: [],
  };
}
