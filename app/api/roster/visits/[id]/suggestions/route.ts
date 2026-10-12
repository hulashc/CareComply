import { NextRequest } from "next/server";
import { idParam, json, readQuery, withAdmin } from "@/lib/roster/http";
import { scoreAllCarers, suggestCarers } from "@/lib/roster/matching-service";
import { suggestionsQuerySchema } from "@/lib/roster/schemas";

type Params = { params: Promise<{ id: string }> };

// GET ?limit=3 (1-10): the best carers for the visit, ranked by the matching engine
// (lib/roster/matching/engine.ts), each with total score, per-factor breakdown, reasons and warnings,
// plus the carers that were filtered out and why.
//
// GET ?all=1[&start=&end=&from_carer=]: a compact score (or exclusion reason) for every carer, for a
// hypothetical time. This is the drag-preview heat map; it has its own, higher rate bucket because
// dragging fires one (debounced, cached) request per time slot.
export async function GET(req: NextRequest, { params }: Params) {
  const all = req.nextUrl.searchParams.get("all");
  const heat = all === "1" || all === "true";
  return withAdmin({ rate: { name: heat ? "roster-score" : "roster-read", limit: heat ? 600 : 120 } }, async (ctx) => {
    const id = idParam((await params).id, "Visit");
    const q = readQuery(req, suggestionsQuerySchema);
    if (!q.all) return json(await suggestCarers(ctx, id, q.limit));
    return json(
      await scoreAllCarers(ctx, id, {
        at: q.start && q.end ? { start_time: new Date(q.start).toISOString(), end_time: new Date(q.end).toISOString() } : undefined,
        asIfUnassigned: q.from_carer ?? null,
      }),
    );
  });
}
