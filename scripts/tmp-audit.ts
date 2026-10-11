import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env.local"), quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

// usage: tmp-audit.ts <actorId>        list audit rows and the current state of each visit touched
async function main() {
  const actor = process.argv[2];
  const r = await db.from("audit_logs").select("*").eq("actor_id", actor).order("created_at");
  if (r.error) throw new Error(r.error.message);
  const ids = [...new Set((r.data ?? []).map((x) => x.entity_id as string))];
  console.log(`${r.data?.length ?? 0} audit rows, ${ids.length} visits touched`);
  for (const id of ids) {
    const v = await db.from("v_roster_visits").select("*").eq("id", id).maybeSingle();
    const row = v.data as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!row) {
      console.log(id, "-> GONE");
      continue;
    }
    let series: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (row.series_id) series = (await db.from("shift_series").select("start_time,duration_minutes,default_carer_ids,required_carers").eq("id", row.series_id).maybeSingle()).data;
    console.log(JSON.stringify({
      id, client: row.client_name, start: row.start_time, end: row.end_time, status: row.status, exc: row.is_series_exception,
      occ: row.occurrence_date, series: row.series_id ? { t: series?.start_time, dur: series?.duration_minutes, def: series?.default_carer_ids } : null,
      carers: (row.carers ?? []).map((c: any) => c.carer_id + ":" + c.full_name), // eslint-disable-line @typescript-eslint/no-explicit-any
      created_by: row.created_by ?? undefined, req: row.required_carers,
    }));
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
