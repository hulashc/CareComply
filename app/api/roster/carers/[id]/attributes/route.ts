import { NextRequest } from "next/server";
import { idParam, json, readJson, withAdmin } from "@/lib/roster/http";
import { getCarerAttributes, updateCarerAttributes } from "@/lib/roster/profile-service";
import { carerAttributesSchema } from "@/lib/roster/schemas";

type Params = { params: Promise<{ id: string }> };

// Matching attributes: skills, languages, gender, transport, max weekly hours, home location.
export async function GET(_req: NextRequest, { params }: Params) {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) =>
    json(await getCarerAttributes(ctx, idParam((await params).id, "Carer"))),
  );
}

// PUT is a partial update: only the fields sent change.
export async function PUT(req: NextRequest, { params }: Params) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Carer");
    return json({ success: true, carer: await updateCarerAttributes(ctx, id, await readJson(req, carerAttributesSchema)) });
  });
}
