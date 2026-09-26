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
  const name = process.argv[2] || "Mohammed Ali";
  const password = process.argv[3] || "CarerDemo123!";

  const { data: carers } = await supabase.from("carers").select("id, full_name, email").eq("full_name", name);
  if (!carers || carers.length === 0) {
    console.log("Carer not found:", name);
    console.log("Available carers:");
    const { data: all } = await supabase.from("carers").select("full_name, email").limit(20);
    all?.forEach(c => console.log(`  ${c.full_name} <${c.email}>`));
    return;
  }
  const carer = carers[0];
  console.log(`Found: ${carer.full_name} <${carer.email}>`);

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: carer.email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    if (authErr.message?.includes("already exists")) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users?.users.find(u => u.email === carer.email);
      if (existing) {
        await supabase.from("carers").update({ auth_id: existing.id }).eq("id", carer.id);
        console.log(`\n✅ Login: ${carer.email} / ${password}`);
        console.log(`   Portal: http://localhost:3000/carer`);
        return;
      }
    }
    console.error("Error:", authErr.message);
    return;
  }

  await supabase.from("carers").update({ auth_id: authUser.user.id }).eq("id", carer.id);
  console.log(`\n✅ Login: ${carer.email} / ${password}`);
  console.log(`   Portal: http://localhost:3000/carer`);
}

main().catch(console.error);
