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
  const { data: carer } = await supabase.from("carers").select("id, full_name, email, auth_id").eq("full_name", "Lucy Chen").single();
  console.log("Carer ID:", carer?.id);
  
  const today = new Date().toISOString().split("T")[0];
  console.log("Today:", today);

  const { data: shifts } = await supabase.from("shifts").select("id, client_id, start_time, end_time, status").eq("carer_id", carer?.id).gte("start_time", today);
  console.log(`Shifts (today+): ${shifts?.length || 0}`);

  const { data: tasks } = await supabase.from("tasks").select("id, title, client_id, status").eq("carer_id", carer?.id).eq("status", "pending");
  console.log(`Pending tasks: ${tasks?.length || 0}`);

  const { data: handovers } = await supabase.from("handover_notes").select("id, note_text, from_carer_id, to_carer_id, is_read").eq("to_carer_id", carer?.id).eq("is_read", false);
  console.log(`Unread handovers: ${handovers?.length || 0}`);

  // Check ALL shifts for this carer
  const { data: allShifts, error: shiftErr } = await supabase.from("shifts").select("id, start_time, status").eq("carer_id", carer?.id);
  console.log(`All shifts for Lucy: ${allShifts?.length || 0}`, shiftErr);

  // Check the server client approach
  console.log("\n--- Checking RLS ---");
  // Try with anon key (simulating client-side)
  const anonSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  // This should fail since no auth context
  const { data: anonCheck } = await anonSupabase.from("shifts").select("id").limit(1);
  console.log("Anon key can read shifts:", !!anonCheck);
}
main().catch(console.error);
