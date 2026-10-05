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
  const { data: carer } = await supabase.from("carers").select("id, full_name, email, auth_id").eq("full_name", "Lucy Chen").single();
  console.log("Carer:", JSON.stringify(carer, null, 2));

  if (carer?.auth_id) {
    const { data: user } = await supabase.auth.admin.getUserById(carer.auth_id);
    console.log("Auth user exists:", !!user?.user);
  } else {
    console.log("auth_id is null — no auth user linked!");
  }

  const { data: users } = await supabase.auth.admin.listUsers();
  const lucy = users?.users.find((u) => u.email === "lucy.chen@heritagecare.co.uk");
  if (lucy) {
    console.log("Auth user found:", lucy.id, lucy.email);
  } else {
    console.log("No auth user found for lucy.chen@heritagecare.co.uk");
  }
}
main().catch(console.error);
