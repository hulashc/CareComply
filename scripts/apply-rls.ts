import { readFileSync } from "fs";
import { resolve } from "path";

const env: Record<string, string> = {};
readFileSync(resolve(__dirname, "../.env.local"), "utf-8").split("\n").forEach(l => {
  const t = l.trim(); if (!t || t.startsWith("#")) return;
  const eq = t.indexOf("="); if (eq === -1) return;
  env[t.slice(0, eq)] = t.slice(eq + 1);
});

const sql = readFileSync(resolve(__dirname, "../supabase/migrations/020_carer_rls_policies.sql"), "utf-8");

// Use Supabase Management API to execute SQL
async function main() {
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL!.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
  if (!projectRef) { console.error("Could not extract project ref from URL"); return; }

  // First try using the service role + /rest/v1/rpc method
  console.log("Project ref:", projectRef);

  // Try the SQL API via the management API
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "apikey": env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text.substring(0, 1000));
}
main().catch(console.error);
