import type { VisitRow } from "../roster/types";
import type { RosterCarer, RosterClient } from "./types";

// Browser-side fetchers for the read-only roster calendar. Same-origin, so the admin's session
// cookie goes with every request. Results are cached per range so flipping back to a week you have
// already loaded is instant; `invalidate()` (the refresh button) clears the cache.

const PAGE = 500;
const cache = new Map<string, Promise<unknown>>();

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = load().catch((e) => {
      cache.delete(key); // do not cache failures
      throw e;
    });
    cache.set(key, hit);
  }
  return hit;
}

export const invalidate = () => cache.clear();

/** Every visit in [from, to] (London dates), paging through the API 500 at a time. */
export function fetchVisits(from: string, to: string): Promise<VisitRow[]> {
  return cached(`visits:${from}:${to}`, async () => {
    const out: VisitRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await getJson<{ visits: VisitRow[]; total: number }>(
        `/api/roster/visits?from=${from}&to=${to}&limit=${PAGE}&offset=${offset}`,
      );
      out.push(...page.visits);
      if (page.visits.length < PAGE || out.length >= page.total) break;
    }
    return out;
  });
}

export function fetchCarers(from: string, to: string): Promise<RosterCarer[]> {
  return cached(`carers:${from}:${to}`, async () => (await getJson<{ carers: RosterCarer[] }>(`/api/roster/availability?from=${from}&to=${to}`)).carers);
}

export function fetchClients(): Promise<RosterClient[]> {
  return cached("clients", async () => (await getJson<{ clients: RosterClient[] }>("/api/roster/clients")).clients);
}

export function fetchSkills(): Promise<{ code: string; name: string }[]> {
  return cached("skills", async () => (await getJson<{ skills: { code: string; name: string; is_active: boolean }[] }>("/api/roster/skills")).skills.filter((s) => s.is_active));
}

// ── Writes (Phase 3) ──

export interface BatchResult {
  visits: VisitRow[];
  deleted: string[];
  already_gone: string[];
}

export interface EditIssue {
  visit_id: string;
  carer_id: string;
  issues: { code: string; message: string }[];
}

/** A failed edit. `code` is STALE / BLOCKED / OVERRIDE_REQUIRED / STARTED when the server said why. */
export class EditError extends Error {
  constructor(message: string, readonly code: string | null, readonly issues: EditIssue[] = [], readonly ids: string[] = []) {
    super(message);
  }
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new EditError("Network error: the change was not saved", "NETWORK");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; code?: string; issues?: EditIssue[]; ids?: string[] };
    throw new EditError(d.error ?? `Request failed (${res.status})`, d.code ?? null, d.issues ?? [], d.ids ?? []);
  }
  return data as T;
}

export interface SnapInput {
  id: string; client_id: string; location_id: string | null; start_time: string; end_time: string;
  required_carers: number; required_skills: string[]; notes: string | null; roster_state: string;
  carer_ids: string[]; series_id: string | null; occurrence_date: string | null; updated_at: string | null;
}

export function postBatch(body: { upserts: SnapInput[]; deletes: { id: string; updated_at: string | null }[]; force?: boolean; reason?: string; label?: string }) {
  return send<BatchResult>("/api/roster/visits/batch", "POST", body).finally(invalidate);
}

/** Recurring edit: PATCH with a scope (this / following / all). */
export function patchVisit(id: string, body: Record<string, unknown>) {
  return send<{ affected: string[] }>(`/api/roster/visits/${id}`, "PATCH", body).finally(invalidate);
}
