// Test builders for the matching engine (imported only by *.test.ts).
import { DEFAULT_WEIGHTS } from "../weights";
import type { Candidate, MatchCarer, MatchClient, MatchInput } from "./types";

// Visit: Tuesday 14 July 2026, 09:00-10:00 London (08:00-09:00Z, BST).
export const VISIT_START = "2026-07-14T08:00:00Z";
export const VISIT_END = "2026-07-14T09:00:00Z";
export const CLIENT_AT = { lat: 51.5, lng: -0.1 };

/** London wall-clock time on the visit day ("HH:mm", BST) as an ISO instant. */
export const at = (hhmm: string, day = "2026-07-14") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), h - 1, m)).toISOString();
};

export function carer(over: Partial<MatchCarer> = {}): MatchCarer {
  return {
    id: "c1", full_name: "Amy Carer", status: "active", is_available: true, gender: "female",
    skills: [], pet_allergies: [], is_smoker: false, max_weekly_hours: null, availability: {},
    languages: [], lat: null, lng: null, contract_hours: null, transport_mode: null,
    driving_licence: false, has_vehicle: false, start_date: null, rating: null,
    ...over,
  };
}

export function candidate(over: Partial<Candidate> = {}, carerOver: Partial<MatchCarer> = {}): Candidate {
  return {
    carer: carer(carerOver), preference: null, absences: [], unavailability: [], otherVisits: [], history: [],
    ...over,
  };
}

export function client(over: Partial<MatchClient> = {}): MatchClient {
  return {
    id: "cl1", full_name: "Asha Patel", display_name: "Mrs Patel", preferred_carer_gender: null,
    carer_gender_required: false, prefers_non_smoking_carer: false, pets: [], primary_language: null,
    lat: CLIENT_AT.lat, lng: CLIENT_AT.lng, key_worker_id: null, has_preferred_carers: false,
    ...over,
  };
}

export function input(candidates: Candidate[], over: Partial<MatchInput> = {}): MatchInput {
  return {
    visit: { id: "v1", client_id: "cl1", start_time: VISIT_START, end_time: VISIT_END, required_skills: [], assigned_carer_ids: [] },
    client: client(),
    candidates,
    weights: { ...DEFAULT_WEIGHTS },
    ...over,
  };
}

/** Past visits to the client: `n` of them, one per `everyDays` days before the visit. */
export function history(n: number, everyDays = 7) {
  return Array.from({ length: n }, (_, i) => ({
    start_time: new Date(new Date(VISIT_START).getTime() - (i + 1) * everyDays * 86_400_000).toISOString(),
    status: "completed",
  }));
}
