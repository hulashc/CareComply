import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { WebSocket } from "ws";

const env: Record<string, string> = {};
readFileSync(resolve(__dirname, "../.env.local"), "utf-8").split("\n").forEach(l => {
  const t = l.trim(); if (!t || t.startsWith("#")) return;
  const eq = t.indexOf("="); if (eq === -1) return;
  env[t.slice(0, eq)] = t.slice(eq + 1);
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

async function main() {
  const tables = ["carers", "shifts", "tasks", "handover_notes", "care_notes", "incidents", "clients", "medications", "medication_logs", "care_plans", "absences", "locations", "documents"];

  for (const t of tables) {
    const { data } = await supabase.rpc("rls_enabled", { table_name: t }).maybeSingle();
    console.log(`${t}:`, data !== null ? data : "unknown");
  }

  // Alternative: query pg_tables directly
  const { data: info } = await supabase.from("carers").select("id").limit(1);
  console.log("\nCan read carers with service key:", info?.length || 0);
}
main().catch(console.error);
