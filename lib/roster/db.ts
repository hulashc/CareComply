import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromDbError } from "./errors";
import type { RosterPlan } from "./types";

/**
 * Untyped admin client, as lib/services/profile-service.ts does: the roster tables are not in
 * lib/database.types.ts until migration 023 is applied and `npm run types` is re-run. Every query
 * is scoped by org_id in code (the service role bypasses RLS), exactly like the other routes.
 */
export type RosterDb = SupabaseClient;

export function createRosterDb(): RosterDb {
  return createAdminClient() as unknown as SupabaseClient;
}

type DbResult<T> = { data: T | null; error: { message?: string; code?: string } | null };

/** Return the data or throw a client-safe RosterError. */
export function unwrap<T>(res: DbResult<T>): T {
  if (res.error) throw fromDbError(res.error);
  return res.data as T;
}

/** PostgREST caps a response (1000 rows by default), so page through large result sets. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<DbResult<T[]>>,
  { pageSize = 1000, maxPages = 20 }: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const rows = unwrap(await page(i * pageSize, (i + 1) * pageSize - 1)) ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

/** Run `fn` over fixed-size chunks (PostgREST puts `in (...)` lists in the URL, so keep them short). */
export async function inChunks<I, O>(items: I[], size: number, fn: (chunk: I[]) => Promise<O[]>): Promise<O[]> {
  const out: O[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))));
  return out;
}

/**
 * Apply a change set atomically (migration 023: roster_apply_plan). The function only receives a
 * whitelisted set of columns and is scoped to `orgId`, and the triggers still enforce capacity.
 */
export async function applyPlan(db: RosterDb, orgId: string, plan: Partial<RosterPlan>): Promise<{ deleted?: number; inserted?: number }> {
  const res = await db.rpc("roster_apply_plan", { p_org: orgId, p_plan: plan });
  return unwrap(res as DbResult<{ deleted?: number; inserted?: number }>) ?? {};
}

export function isEmptyPlan(plan: RosterPlan): boolean {
  return Object.values(plan).every((v) => v.length === 0);
}
