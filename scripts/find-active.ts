import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { WebSocket } from "ws";

const env: Record<string, string> = {};
readFileSync(resolve("C:/Users/Hulash Chand/OneDrive/Desktop/care_compliance/carecomply/.env.local"), "utf-8").split("\n").forEach(l => {
  const t = l.trim(); if (!t || t.startsWith("#")) return;
  const eq = t.indexOf("="); if (eq === -1) return;
  env[t.slice(0, eq)] = t.slice(eq + 1);
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

async function main() {
  const { data: orgs } = await supabase.from("organizations").select("id").eq("name", "Heritage Healthcare Leicester").single();
  if (!orgs) { console.log("Org not found"); return; }
  const orgId = orgs.id;

  const { data: carers } = await supabase.from("carers").select("id, full_name, email").eq("org_id", orgId);
  if (!carers) { console.log("No carers"); return; }

  const carerCounts: Record<string, { name: string; email: string; count: number }> = {};
  carers.forEach(c => { carerCounts[c.id] = { name: c.full_name, email: c.email || "", count: 0 }; });

  const { data: shifts } = await supabase.from("shifts").select("carer_id").eq("org_id", orgId);
  shifts?.forEach((s) => { if (carerCounts[s.carer_id]) carerCounts[s.carer_id].count++; });

  const { data: tasks } = await supabase.from("tasks").select("carer_id").eq("org_id", orgId);
  tasks?.forEach((t) => { if (carerCounts[t.carer_id]) carerCounts[t.carer_id].count += 2; });

  const { data: notes } = await supabase.from("care_notes").select("carer_id").eq("org_id", orgId);
  notes?.forEach((n) => { if (carerCounts[n.carer_id]) carerCounts[n.carer_id].count += 2; });

  const { data: handovers } = await supabase.from("handover_notes").select("from_carer_id, to_carer_id").eq("org_id", orgId);
  handovers?.forEach((h) => {
    if (carerCounts[h.from_carer_id]) carerCounts[h.from_carer_id].count++;
    if (carerCounts[h.to_carer_id]) carerCounts[h.to_carer_id].count++;
  });

  const sorted = Object.values(carerCounts).sort((a, b) => b.count - a.count);
  console.log("\nCarers by activity score:\n");
  sorted.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} — ${c.count} pts — <${c.email}>`));
  console.log(`\n  Most active: ${sorted[0]?.name} <${sorted[0]?.email}>\n`);
}
main().catch(console.error);
