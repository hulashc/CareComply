import type { EligibilityAbsence, EligibilityCarer, EligibilityClient, EligibilityVisit, IssueCode } from "../eligibility";
import type { TransportMode } from "../types";
import type { MatchingWeights, WeightKey } from "../weights";
import type { DistanceService } from "./distance";

// Input and output shapes of the matching engine. Everything the engine needs is passed in;
// it never reads the database or the clock.

export interface MatchVisit extends EligibilityVisit {
  client_id: string;
  /** Carers already on this visit; they are not suggested again. */
  assigned_carer_ids: string[];
}

export interface MatchClient extends EligibilityClient {
  id: string;
  full_name: string | null;
  /** How reasons name the client, e.g. "Mrs Patel"; falls back to full_name. */
  display_name?: string | null;
  primary_language: string | null;
  lat: number | null;
  lng: number | null;
  key_worker_id: string | null;
  /** Whether the client has any preferred carers (decides if that factor applies). */
  has_preferred_carers: boolean;
}

export interface MatchCarer extends EligibilityCarer {
  full_name: string;
  languages: string[];
  lat: number | null;
  lng: number | null;
  contract_hours: number | null;
  transport_mode: TransportMode | null;
  driving_licence: boolean;
  has_vehicle: boolean;
  /** Employment start (YYYY-MM-DD), for experience. */
  start_date: string | null;
  /** 1-5 when the org records ratings. */
  rating?: number | null;
}

/** One of the carer's other visits; lat/lng are that visit's client location. */
export interface CarerVisit {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
}

export interface Candidate {
  carer: MatchCarer;
  preference: "preferred" | "excluded" | null;
  absences: EligibilityAbsence[];
  unavailability: { starts_at: string; ends_at: string }[];
  /** The carer's visits in the visit's Monday-Sunday week (any client, any status). */
  otherVisits: CarerVisit[];
  /** The carer's visits to this client (at least the 90 days before the visit). */
  history: { start_time: string; status: string }[];
}

export interface MatchInput {
  visit: MatchVisit;
  client: MatchClient;
  candidates: Candidate[];
  weights: MatchingWeights;
  distance?: DistanceService;
}

export interface FactorResult {
  /** 0..1, or null when the factor does not apply to this client. */
  value: number | null;
  reasons: string[];
  warnings: string[];
}

export interface FactorScore {
  value: number | null;
  weight: number;
  /** Contribution to the 0-100 total. */
  points: number;
  applicable: boolean;
}

export interface ScoredCandidate {
  carer_id: string;
  full_name: string;
  total: number;
  breakdown: Record<WeightKey, FactorScore>;
  reasons: string[];
  warnings: string[];
  /** Average minutes per travel leg, null if unknown (tie-break). */
  travel_minutes: number | null;
}

export interface ExcludedCandidate {
  carer_id: string;
  full_name: string;
  issues: { code: IssueCode | "ALREADY_ASSIGNED"; message: string }[];
}
