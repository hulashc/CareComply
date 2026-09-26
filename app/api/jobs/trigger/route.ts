import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { dispatchJob, type JobType } from "@/lib/jobs/queue";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, ...payload } = body;

  if (!type || typeof type !== "string") {
    return NextResponse.json({ error: "Job type is required" }, { status: 400 });
  }

  const validPrefixes = ["email:", "report:", "ai:"];
  if (!validPrefixes.some((p) => (type as string).startsWith(p))) {
    return NextResponse.json({ error: "Invalid job type" }, { status: 400 });
  }

  const jobId = await dispatchJob(type as JobType, payload);
  if (!jobId) {
    return NextResponse.json({ error: "Job queue not available" }, { status: 503 });
  }

  return NextResponse.json({ success: true, jobId });
}
