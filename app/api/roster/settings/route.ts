import { NextRequest } from "next/server";
import { json, readJson, withAdmin } from "@/lib/roster/http";
import { getSettings, updateSettings } from "@/lib/roster/profile-service";
import { settingsSchema } from "@/lib/roster/schemas";

// Org-level matching weights (defaults merged with this org's overrides).
export async function GET() {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) => json(await getSettings(ctx)));
}

// PUT body: { weights?: { travel: 30, ... }, reset?: true }. Partial: only the weights sent change.
export async function PUT(req: NextRequest) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) =>
    json({ success: true, ...(await updateSettings(ctx, await readJson(req, settingsSchema))) }),
  );
}
