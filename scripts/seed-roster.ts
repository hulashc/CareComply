import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { londonDateOf } from "../lib/dates/london";
import { buildDemoRoster } from "./seed-roster-build";
import { DEMO_TAG, SKILLS } from "./seed-roster-data";

// Seeds realistic rostering data into ONE existing organisation.
//
//   npm run seed:roster -- --list                    show organisations and their ids
//   npm run seed:roster -- --org <id> --dry-run      build the roster in memory and print the stats
//   npm run seed:roster -- --org <id>                seed (refuses if demo data is already there)
//   npm run seed:roster -- --org <id> --reset        remove the demo data, then seed again
//   npm run seed:roster -- --org <id> --scale 100    performance test data: 100 carers, 75 clients, ~1,000 visits a week
//   npm run seed:roster -- --org <id> --clean        remove the demo data
//
// Everything created is tagged "[roster-demo]" (carers.notes, clients.care_notes, absences.reason,
// series notes) and carers use @roster-demo.test emails, so --clean removes exactly that and
// nothing else. The skills catalogue is org configuration and is kept.
// Needs migration 023 applied. Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.

config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function connect(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function check<T>(label: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data as T;
}

async function listOrgs(db: SupabaseClient) {
  const orgs = check("organizations", await db.from("organizations").select("id, name").order("name")) as { id: string; name: string }[];
  console.log("\nOrganisations:\n");
  for (const o of orgs) {
    const carers = (await db.from("carers").select("*", { count: "exact", head: true }).eq("org_id", o.id)).count ?? 0;
    const clients = (await db.from("clients").select("*", { count: "exact", head: true }).eq("org_id", o.id)).count ?? 0;
    console.log(`  ${o.id}  ${o.name}  (${carers} carers, ${clients} clients)`);
  }
  console.log("\nSeed one with:  npm run seed:roster -- --org <id>\n");
}

async function demoIds(db: SupabaseClient, orgId: string) {
  const carers = check("demo carers", await db.from("carers").select("id").eq("org_id", orgId).like("notes", `${DEMO_TAG}%`)) as { id: string }[];
  const clients = check("demo clients", await db.from("clients").select("id").eq("org_id", orgId).like("care_notes", `${DEMO_TAG}%`)) as { id: string }[];
  return { carers: carers.map((c) => c.id), clients: clients.map((c) => c.id) };
}

async function clean(db: SupabaseClient, orgId: string) {
  const { carers, clients } = await demoIds(db, orgId);
  // Deleting clients cascades to their visits, series, assignments and preferences; deleting
  // carers cascades to their leave and unavailability.
  if (clients.length) check("delete clients", await db.from("clients").delete().eq("org_id", orgId).in("id", clients));
  if (carers.length) check("delete carers", await db.from("carers").delete().eq("org_id", orgId).in("id", carers));
  console.log(`Removed ${clients.length} demo clients (with their visits) and ${carers.length} demo carers.`);
}

async function insert(db: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  check(`insert ${table}`, await db.from(table).insert(rows));
}

async function main() {
  if (flag("list")) return listOrgs(connect());

  const orgId = option("org");
  if (!orgId) {
    console.error("Pass --org <id> (see --list), or --list to find it.");
    process.exit(1);
  }
  const scale = option("scale") ? Number(option("scale")) : undefined;
  if (scale !== undefined && (!Number.isInteger(scale) || scale < 15 || scale > 300)) throw new Error("--scale must be a whole number from 15 to 300 (the number of carers)");
  const now = new Date();
  const today = londonDateOf(now);

  if (flag("dry-run")) {
    const roster = buildDemoRoster({ orgId, adminId: null, today, now, scale });
    console.log("Dry run (nothing written). Built in memory:");
    console.table(roster.stats);
    return;
  }

  const db = connect();
  const org = check("organization", await db.from("organizations").select("id, name").eq("id", orgId).maybeSingle()) as { id: string; name: string } | null;
  if (!org) throw new Error(`No organisation with id ${orgId}. Run with --list.`);
  console.log(`Organisation: ${org.name} (${org.id})`);

  if (flag("clean")) return clean(db, orgId);

  const existing = await demoIds(db, orgId);
  if (existing.carers.length || existing.clients.length) {
    if (!flag("reset")) {
      console.error(`Demo data is already seeded (${existing.carers.length} carers, ${existing.clients.length} clients). Use --reset to replace it, or --clean to remove it.`);
      process.exit(1);
    }
    await clean(db, orgId);
  }

  const admin = (check("admin", await db.from("admins").select("id").eq("org_id", orgId).limit(1)) as { id: string }[])[0];
  const roster = buildDemoRoster({ orgId, adminId: admin?.id ?? null, today, now, scale });

  console.log("Writing skills, people, leave and preferences...");
  check("skills", await db.from("skills").upsert(SKILLS.map((s) => ({ org_id: orgId, ...s })), { onConflict: "org_id,code", ignoreDuplicates: true }));
  await insert(db, "carers", roster.carers);
  await insert(db, "clients", roster.clients);
  await insert(db, "client_carer_preferences", roster.preferences);
  await insert(db, "absences", roster.absences);
  await insert(db, "carer_unavailability", roster.unavailability);

  console.log(`Writing ${roster.plans.length} recurring series and their visits...`);
  for (const plan of roster.plans) {
    check("roster_apply_plan", await db.rpc("roster_apply_plan", { p_org: orgId, p_plan: plan }));
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  console.log("Recording today's progress and tomorrow's confirmations...");
  for (const c of roster.updates.completed) {
    check("complete visit", await db.from("shifts").update({ status: "completed", actual_start: c.actual_start, actual_end: c.actual_end }).eq("id", c.id));
  }
  for (const p of roster.updates.inProgress) {
    check("start visit", await db.from("shifts").update({ status: "in_progress", actual_start: p.actual_start }).eq("id", p.id));
  }
  for (let i = 0; i < roster.updates.confirmed.length; i += 100) {
    check("confirm visits", await db.from("shifts").update({ status: "confirmed" }).in("id", roster.updates.confirmed.slice(i, i + 100)));
  }

  // Verify against the database itself, not just what we meant to write.
  const ids = await demoIds(db, orgId);
  const visits = (await db.from("shifts").select("*", { count: "exact", head: true }).in("client_id", ids.clients)).count ?? 0;
  const open = (await db.from("v_unassigned_shifts").select("*", { count: "exact", head: true }).in("client_id", ids.clients)).count ?? 0;
  const conflicts = (await db.from("v_carer_shift_conflicts").select("*", { count: "exact", head: true }).in("carer_id", ids.carers)).count ?? 0;

  console.log("\nSeeded. Planned:");
  console.table(roster.stats);
  console.log(`In the database: ${visits} visits; ${open} not yet over and still needing a carer; ${conflicts} carer conflicts (expected 0).`);
  console.log("Remove it all later with:  npm run seed:roster -- --org " + orgId + " --clean");
}

main().catch((e) => {
  console.error("\nSeed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
