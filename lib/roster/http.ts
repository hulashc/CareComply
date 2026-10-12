import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { createRosterDb, type RosterDb } from "./db";
import { RosterError, fromDbError } from "./errors";

// Shared plumbing for the /api/roster routes, mirroring the existing routes' flow:
// admin guard -> rate limit -> parse + validate -> org-scoped work -> JSON.
// Errors become { error } (plus { issues } for validation) with a meaningful status.

export interface RosterCtx {
  db: RosterDb;
  orgId: string;
  adminId: string;
}

interface Options {
  /** Per-admin requests per minute for this endpoint family. */
  rate?: { name: string; limit: number };
}

export async function withAdmin(opts: Options, handler: (ctx: RosterCtx) => Promise<NextResponse>): Promise<NextResponse> {
  try {
    const admin = await getCurrentAdmin();
    if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    if (opts.rate) {
      const rl = await rateLimit(`${opts.rate.name}:${admin.id}`, opts.rate.limit);
      if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return await handler({ db: createRosterDb(), orgId: admin.org_id, adminId: admin.id });
  } catch (e) {
    return errorResponse(e);
  }
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof RosterError) {
    return NextResponse.json({ error: e.message, ...e.body }, { status: e.status });
  }
  // A raw PostgREST error that escaped unwrap().
  if (e && typeof e === "object" && "message" in e && ("code" in e || "details" in e)) {
    const mapped = fromDbError(e as { message?: string; code?: string });
    return NextResponse.json({ error: mapped.message, ...mapped.body }, { status: mapped.status });
  }
  console.error("[roster] unexpected error:", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function validationError(error: z.ZodError): RosterError {
  return new RosterError("Validation failed", 400, {
    issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

/** Parse a JSON body against a schema; throws a 400 RosterError. */
export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new RosterError("Invalid JSON body", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

/** Parse the URL query string against a schema; throws a 400 RosterError. */
export function readQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

const uuidSchema = z.uuid();

/** A path parameter that must be a UUID; anything else cannot exist, so it is a 404. */
export function idParam(value: string, what = "Record"): string {
  if (!uuidSchema.safeParse(value).success) throw new RosterError(`${what} not found`, 404);
  return value;
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
