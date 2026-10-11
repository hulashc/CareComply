import type { z } from "zod";
import { unwrap } from "./db";
import { RosterError } from "./errors";
import type { RosterCtx } from "./http";
import type {
  carerAttributesSchema,
  clientPreferencesSchema,
  createSkillSchema,
  settingsSchema,
  updateSkillSchema,
} from "./schemas";
import { overridesOf, resolveWeights, type MatchingWeights } from "./weights";

// Matching inputs that live on the carer / client / org: skills, carer attributes, client
// preferences and exclusions, matching weights. Existing columns are reused where they exist
// (gender, languages via primary_language, allergies, vehicle...); migration 023 added the rest.

// ── Skills catalogue ─────────────────────────────────────────────────────────

export async function listSkills(ctx: RosterCtx) {
  return unwrap(await ctx.db.from("skills").select("id, code, name, is_active").eq("org_id", ctx.orgId).order("name")) ?? [];
}

export async function createSkill(ctx: RosterCtx, body: z.output<typeof createSkillSchema>) {
  const existing = unwrap(await ctx.db.from("skills").select("id").eq("org_id", ctx.orgId).eq("code", body.code).maybeSingle());
  if (existing) throw new RosterError(`A skill with code '${body.code}' already exists`, 409);
  return unwrap(await ctx.db.from("skills").insert({ org_id: ctx.orgId, code: body.code, name: body.name }).select("id, code, name, is_active").single());
}

/** Codes are immutable (carers and visits reference them); rename via `name`, retire via `is_active`. */
export async function updateSkill(ctx: RosterCtx, id: string, body: z.output<typeof updateSkillSchema>) {
  const row = unwrap(await ctx.db.from("skills").update(body).eq("id", id).eq("org_id", ctx.orgId).select("id, code, name, is_active").maybeSingle());
  if (!row) throw new RosterError("Skill not found", 404);
  return row;
}

/** Every code must exist (and be active) in the org's catalogue. */
export async function assertSkills(ctx: RosterCtx, codes: string[]): Promise<void> {
  if (codes.length === 0) return;
  const known = unwrap(await ctx.db.from("skills").select("code").eq("org_id", ctx.orgId).eq("is_active", true).in("code", codes)) as { code: string }[] | null;
  const missing = codes.filter((c) => !(known ?? []).some((k) => k.code === c));
  if (missing.length > 0) throw new RosterError(`Unknown or inactive skill code(s): ${missing.join(", ")}`, 400);
}

// ── Carer attributes ─────────────────────────────────────────────────────────

const CARER_FIELDS = "id, full_name, status, gender, skills, languages, transport_mode, max_weekly_hours, lat, lng, is_smoker, pet_allergies, driving_licence, has_vehicle, contract_hours, postcode, availability";

export async function getCarerAttributes(ctx: RosterCtx, carerId: string) {
  const row = unwrap(await ctx.db.from("carers").select(CARER_FIELDS).eq("id", carerId).eq("org_id", ctx.orgId).maybeSingle());
  if (!row) throw new RosterError("Carer not found", 404);
  return row;
}

export async function updateCarerAttributes(ctx: RosterCtx, carerId: string, body: z.output<typeof carerAttributesSchema>) {
  if (body.skills) await assertSkills(ctx, body.skills);
  const row = unwrap(await ctx.db.from("carers").update(body).eq("id", carerId).eq("org_id", ctx.orgId).select(CARER_FIELDS).maybeSingle());
  if (!row) throw new RosterError("Carer not found", 404);
  return row;
}

// ── Client preferences and exclusions ────────────────────────────────────────

const CLIENT_FIELDS = "id, full_name, gender, primary_language, interpreter_needed, preferred_carer_gender, carer_gender_required, prefers_non_smoking_carer, pets, allergies, lat, lng, postcode";

export async function getClientPreferences(ctx: RosterCtx, clientId: string) {
  const client = unwrap(await ctx.db.from("clients").select(CLIENT_FIELDS).eq("id", clientId).eq("org_id", ctx.orgId).maybeSingle()) as Record<string, unknown> | null;
  if (!client) throw new RosterError("Client not found", 404);
  const links = (unwrap(await ctx.db.from("client_carer_preferences").select("carer_id, kind, reason").eq("client_id", clientId).eq("org_id", ctx.orgId)) ?? []) as { carer_id: string; kind: string; reason: string | null }[];
  return {
    ...client,
    preferred_carers: links.filter((l) => l.kind === "preferred").map(({ carer_id, reason }) => ({ carer_id, reason })),
    excluded_carers: links.filter((l) => l.kind === "excluded").map(({ carer_id, reason }) => ({ carer_id, reason })),
  };
}

export async function updateClientPreferences(ctx: RosterCtx, clientId: string, body: z.output<typeof clientPreferencesSchema>) {
  const { db, orgId } = ctx;
  const { preferred_carers, excluded_carers, ...columns } = body;

  const client = unwrap(await db.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle());
  if (!client) throw new RosterError("Client not found", 404);

  // Every carer named must belong to this org.
  const named = [...(preferred_carers ?? []), ...(excluded_carers ?? [])].map((c) => c.carer_id);
  if (named.length > 0) {
    const found = (unwrap(await db.from("carers").select("id").eq("org_id", orgId).in("id", named)) ?? []) as { id: string }[];
    if (found.length !== new Set(named).size) throw new RosterError("One or more carers were not found", 404);
  }

  // A carer can be in only one list (unique per client + carer), so check the list we are NOT
  // replacing for clashes before touching anything.
  const lists = [["preferred", preferred_carers], ["excluded", excluded_carers]] as const;
  for (const [kind, incoming] of lists) {
    if (!incoming) continue;
    const other = kind === "preferred" ? "excluded" : "preferred";
    const otherIds = (kind === "preferred" ? excluded_carers : preferred_carers) === undefined
      ? ((unwrap(await db.from("client_carer_preferences").select("carer_id").eq("client_id", clientId).eq("org_id", orgId).eq("kind", other)) ?? []) as { carer_id: string }[]).map((r) => r.carer_id)
      : [];
    const clash = incoming.find((c) => otherIds.includes(c.carer_id));
    if (clash) throw new RosterError(`That carer is already on the client's ${other} list; remove them there first`, 409);
  }

  if (Object.keys(columns).length > 0) {
    unwrap(await db.from("clients").update(columns).eq("id", clientId).eq("org_id", orgId));
  }
  // Delete every replaced list before inserting any, so a carer moving between lists in one
  // request does not trip the unique (client, carer) constraint.
  for (const [kind, incoming] of lists) {
    if (incoming) unwrap(await db.from("client_carer_preferences").delete().eq("client_id", clientId).eq("org_id", orgId).eq("kind", kind));
  }
  for (const [kind, incoming] of lists) {
    if (incoming && incoming.length > 0) {
      unwrap(await db.from("client_carer_preferences").insert(
        incoming.map((c) => ({ org_id: orgId, client_id: clientId, carer_id: c.carer_id, kind, reason: c.reason ?? null })),
      ));
    }
  }
  return getClientPreferences(ctx, clientId);
}

// ── Matching weights ─────────────────────────────────────────────────────────

export async function getSettings(ctx: RosterCtx): Promise<{ weights: MatchingWeights }> {
  const row = unwrap(await ctx.db.from("roster_settings").select("weights").eq("org_id", ctx.orgId).maybeSingle()) as { weights: unknown } | null;
  return { weights: resolveWeights(row?.weights) };
}

export async function updateSettings(ctx: RosterCtx, body: z.output<typeof settingsSchema>): Promise<{ weights: MatchingWeights }> {
  const current = body.reset ? resolveWeights({}) : (await getSettings(ctx)).weights;
  const next = { ...current, ...(body.reset ? {} : body.weights) } as MatchingWeights;
  unwrap(await ctx.db.from("roster_settings").upsert(
    { org_id: ctx.orgId, weights: overridesOf(next), updated_by: ctx.adminId, updated_at: new Date().toISOString() },
    { onConflict: "org_id" },
  ));
  return { weights: next };
}
