import { NextRequest } from "next/server";
import { json, readJson, withAdmin } from "@/lib/roster/http";
import { createSkill, listSkills } from "@/lib/roster/profile-service";
import { createSkillSchema } from "@/lib/roster/schemas";

export async function GET() {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) => json({ skills: await listSkills(ctx) }));
}

// POST body: { code: "peg_feeding", name: "PEG feeding" }. The code is permanent; the name can change.
export async function POST(req: NextRequest) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) =>
    json({ success: true, skill: await createSkill(ctx, await readJson(req, createSkillSchema)) }, 201),
  );
}
