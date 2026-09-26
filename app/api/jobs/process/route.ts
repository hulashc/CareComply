import { NextRequest, NextResponse } from "next/server";
import { processNextJob } from "@/lib/jobs/queue";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let processed = 0;
  const maxBatch = 10;

  while (processed < maxBatch) {
    const job = await processNextJob();
    if (!job) break;
    processed++;
  }

  return NextResponse.json({ processed });
}
