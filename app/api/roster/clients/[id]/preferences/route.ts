import { NextRequest } from "next/server";
import { idParam, json, readJson, withAdmin } from "@/lib/roster/http";
import { getClientPreferences, updateClientPreferences } from "@/lib/roster/profile-service";
import { clientPreferencesSchema } from "@/lib/roster/schemas";

type Params = { params: Promise<{ id: string }> };

// Client preferences and exclusions: preferred gender (optionally required), language, pets,
// allergies, non-smoker preference, preferred carers, and the do-not-pair (excluded) carers.
export async function GET(_req: NextRequest, { params }: Params) {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) =>
    json(await getClientPreferences(ctx, idParam((await params).id, "Client"))),
  );
}

// PUT is a partial update. `preferred_carers` / `excluded_carers` replace that whole list when sent.
export async function PUT(req: NextRequest, { params }: Params) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Client");
    return json({ success: true, client: await updateClientPreferences(ctx, id, await readJson(req, clientPreferencesSchema)) });
  });
}
