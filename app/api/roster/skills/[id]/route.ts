import { NextRequest } from "next/server";
import { idParam, json, readJson, withAdmin } from "@/lib/roster/http";
import { updateSkill } from "@/lib/roster/profile-service";
import { updateSkillSchema } from "@/lib/roster/schemas";

// PATCH body: { name?, is_active? }. Retire a skill with is_active=false rather than deleting it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Skill");
    return json({ success: true, skill: await updateSkill(ctx, id, await readJson(req, updateSkillSchema)) });
  });
}
