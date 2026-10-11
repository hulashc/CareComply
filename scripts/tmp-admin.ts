import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// usage: tsx tmp-admin.ts create <org> | clean <userId>
config({ path: "C:/Users/shahe/OneDrive/Documents/GitHub/CareComply/.env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "create") {
    const email = `roster-ui-test-${Date.now()}@roster-demo.test`;
    const password = `Ui-${crypto.randomUUID()}`;
    const u = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (u.error || !u.data.user) throw new Error(u.error?.message);
    const a = await db.from("admins").insert({ id: u.data.user.id, org_id: arg, full_name: "Roster UI test", role: "admin" });
    if (a.error) throw new Error(a.error.message);
    console.log(JSON.stringify({ userId: u.data.user.id, email, password }));
  } else if (cmd === "clean") {
    await db.from("admins").delete().eq("id", arg);
    const r = await db.auth.admin.deleteUser(arg);
    console.log(r.error ? `FAILED ${r.error.message}` : "cleaned");
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
