import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { resolve } from "node:path";

// End-to-end smoke test of /api/roster/* against a RUNNING dev server and the real database.
//
//   npm run dev                                           (in another terminal)
//   npx tsx scripts/roster-smoke.ts --org <org id> [--base http://localhost:3000]
//
// It creates a temporary admin (and signs in as them), its own client, carers, skill and a second
// organisation, exercises the API, then deletes everything it created. Visits live in December 2026
// (plus a DST check in late October), away from the seed data. Needs migration 023 applied.

config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const args = process.argv.slice(2);
const option = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = option("base") ?? "http://localhost:3000";
const ORG = option("org");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let passed = 0;
const failures: string[] = [];
function expect(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail !== undefined ? `\n          ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  }
}
const section = (s: string) => console.log(`\n${s}`);

let cookie = "";
async function call(method: string, path: string, body?: unknown, auth = true): Promise<{ status: number; json: Json }> {
  // The API rate-limits each admin per minute and this test makes ~100 writes: wait out a 429.
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await callOnce(method, path, body, auth);
    if (r.status !== 429) return r;
    console.log("  (rate limited, waiting 15s)");
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  return callOnce(method, path, body, auth);
}

async function callOnce(method: string, path: string, body?: unknown, auth = true): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(auth ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: Json = {};
  try {
    json = await res.json();
  } catch {
    /* redirects / empty bodies */
  }
  return { status: res.status, json };
}

const londonHHmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const codes = (list: { code: string }[] | undefined) => (list ?? []).map((i) => i.code);

async function listDay(from: string, to = from, extra = ""): Promise<Json[]> {
  const r = await call("GET", `/api/roster/visits?from=${from}&to=${to}${extra}`);
  return r.json.visits ?? [];
}

async function main() {
  if (!ORG) throw new Error("Pass --org <organisation id> (npm run seed:roster -- --list shows them)");
  if (!URL || !SERVICE || !PUBLISHABLE) throw new Error("Supabase env vars missing in .env.local");
  const db: SupabaseClient = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const tag = `[roster-smoke ${Date.now()}]`;
  // The test changes this org's matching weights; remember them so cleanup can restore them exactly.
  const settingsBefore = (await db.from("roster_settings").select("*").eq("org_id", ORG).maybeSingle()).data as Json | null;
  const created = { userId: "", clientIds: [] as string[], carerIds: [] as string[], skillIds: [] as string[], orgIds: [] as string[] };

  try {
    // ── set-up: temporary admin, signed in through the real auth cookies ──
    const email = `roster-smoke-${Date.now()}@roster-demo.test`;
    const password = `Smoke-${crypto.randomUUID()}`;
    const user = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (user.error || !user.data.user) throw new Error(`create admin user: ${user.error?.message}`);
    created.userId = user.data.user.id;
    const adminRow = await db.from("admins").insert({ id: created.userId, org_id: ORG, full_name: "Roster smoke test", role: "admin" });
    if (adminRow.error) throw new Error(`create admin row: ${adminRow.error.message}`);

    const jar = new Map<string, string>();
    const ssr = createServerClient(URL, PUBLISHABLE, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    const signIn = await ssr.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`sign in: ${signIn.error.message}`);
    await new Promise((r) => setTimeout(r, 300));
    cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (!cookie) throw new Error("No auth cookies were produced");

    const mk = async (table: string, row: Json) => {
      const r = await db.from(table).insert({ org_id: ORG, ...row }).select("id").single();
      if (r.error) throw new Error(`insert ${table}: ${r.error.message}`);
      return r.data.id as string;
    };
    const client = await mk("clients", { full_name: "Smoke Client", care_notes: tag });
    const carerA = await mk("carers", { full_name: "Smoke Carer A", gender: "Female", notes: tag, status: "active" });
    const carerB = await mk("carers", { full_name: "Smoke Carer B", gender: "Male", notes: tag, status: "active" });
    const carerC = await mk("carers", { full_name: "Smoke Carer C", gender: "Female", notes: tag, status: "active" });
    created.clientIds.push(client);
    created.carerIds.push(carerA, carerB, carerC);

    // ── auth and tenancy ──
    section("Authentication and tenancy");
    const anon = await call("GET", "/api/roster/visits?from=2026-12-01&to=2026-12-02", undefined, false);
    expect("anonymous requests are turned away", [307, 401, 403].includes(anon.status), anon.status);

    const otherOrg = await db.from("organizations").insert({ name: `${tag} other org` }).select("id").single();
    created.orgIds.push(otherOrg.data!.id);
    const foreignClient = (await db.from("clients").insert({ org_id: otherOrg.data!.id, full_name: "Foreign Client", care_notes: tag }).select("id").single()).data!.id as string;
    created.clientIds.push(foreignClient);
    const foreignPost = await call("POST", "/api/roster/visits", { client_id: foreignClient, date: "2026-12-01", start_time: "09:00", end_time: "10:00" });
    expect("cannot create a visit for another organisation's client (404)", foreignPost.status === 404, foreignPost);
    expect("another organisation's client has no visible visits", (await listDay("2026-12-01", "2026-12-31", `&client_id=${foreignClient}`)).length === 0);

    // ── validation ──
    section("Validation");
    const bad1 = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-02-30", start_time: "09:00", end_time: "10:00" });
    expect("impossible date -> 400 with issues", bad1.status === 400 && Array.isArray(bad1.json.issues), bad1);
    const bad2 = await call("GET", "/api/roster/visits?from=2026-01-01&to=2026-12-31");
    expect("range over 62 days -> 400", bad2.status === 400, bad2);
    expect("unknown visit -> 404", (await call("GET", `/api/roster/visits/${crypto.randomUUID()}`)).status === 404);
    expect("malformed id -> 404", (await call("GET", "/api/roster/visits/not-a-uuid")).status === 404);
    expect("invalid JSON -> 400", (await call("POST", "/api/roster/visits", undefined)).status === 400);

    // ── skills and settings ──
    section("Skills, matching weights");
    const sk = await call("POST", "/api/roster/skills", { code: "smoke_hoist", name: "Smoke hoist" });
    expect("create skill (201)", sk.status === 201, sk);
    if (sk.json.skill?.id) created.skillIds.push(sk.json.skill.id);
    expect("duplicate skill code -> 409", (await call("POST", "/api/roster/skills", { code: "smoke_hoist", name: "Again" })).status === 409);
    const renamed = await call("PATCH", `/api/roster/skills/${sk.json.skill?.id}`, { name: "Smoke hoist (renamed)" });
    expect("rename skill", renamed.status === 200 && renamed.json.skill?.name === "Smoke hoist (renamed)", renamed);
    expect("skill listed", ((await call("GET", "/api/roster/skills")).json.skills ?? []).some((s: Json) => s.code === "smoke_hoist"));

    const w0 = (await call("GET", "/api/roster/settings")).json.weights ?? {};
    expect("settings return all seven weights", Object.values(w0 as Record<string, number>).length === 7, w0);
    const w1 = await call("PUT", "/api/roster/settings", { weights: { travel: 33 } });
    expect("partial weight update", w1.status === 200 && w1.json.weights?.travel === 33 && w1.json.weights?.continuity === w0.continuity, w1);
    expect("out-of-range weight -> 400", (await call("PUT", "/api/roster/settings", { weights: { travel: 101 } })).status === 400);
    const w2 = await call("PUT", "/api/roster/settings", { reset: true });
    expect("reset weights to defaults", w2.status === 200 && w2.json.weights?.travel === 20, w2);

    // ── carer attributes, client preferences, availability ──
    section("Carer attributes, client preferences, availability");
    const attrs = await call("PUT", `/api/roster/carers/${carerA}/attributes`, { skills: ["smoke_hoist"], languages: ["English", "Urdu"], transport_mode: "car", max_weekly_hours: 40, lat: 52.63, lng: -1.13 });
    expect("update carer attributes", attrs.status === 200 && attrs.json.carer?.skills?.[0] === "smoke_hoist", attrs);
    expect("unknown skill code -> 400", (await call("PUT", `/api/roster/carers/${carerB}/attributes`, { skills: ["does_not_exist"] })).status === 400);
    expect("lat without lng -> 400", (await call("PUT", `/api/roster/carers/${carerB}/attributes`, { lat: 52 })).status === 400);
    const got = await call("GET", `/api/roster/carers/${carerA}/attributes`);
    expect("read carer attributes", got.json.languages?.includes("Urdu") && got.json.transport_mode === "car", got);

    const prefs = await call("PUT", `/api/roster/clients/${client}/preferences`, {
      preferred_carer_gender: "female", pets: ["dog"], prefers_non_smoking_carer: true, primary_language: "English",
      preferred_carers: [{ carer_id: carerA }], excluded_carers: [{ carer_id: carerC, reason: "Smoke test exclusion" }],
    });
    expect("update client preferences and exclusions", prefs.status === 200 && prefs.json.client?.excluded_carers?.length === 1, prefs);
    expect("a carer cannot be both preferred and excluded -> 400", (await call("PUT", `/api/roster/clients/${client}/preferences`, { preferred_carers: [{ carer_id: carerC }], excluded_carers: [{ carer_id: carerC }] })).status === 400);
    expect("moving an excluded carer into 'preferred' alone -> 409", (await call("PUT", `/api/roster/clients/${client}/preferences`, { preferred_carers: [{ carer_id: carerC }] })).status === 409);

    const hours = await call("PUT", `/api/roster/carers/${carerA}/working-hours`, { mon: [{ start: "07:00", end: "15:00" }], tue: [{ start: "07:00", end: "15:00" }] });
    expect("set working hours", hours.status === 200 && hours.json.working_hours?.mon?.length === 1, hours);
    expect("reversed window -> 400", (await call("PUT", `/api/roster/carers/${carerA}/working-hours`, { mon: [{ start: "15:00", end: "07:00" }] })).status === 400);
    const block = await call("POST", `/api/roster/carers/${carerB}/unavailability`, { date: "2026-12-04", start_time: "12:00", end_time: "16:00", reason: "Smoke appointment" });
    expect("add unavailability block (201)", block.status === 201 && !!block.json.block?.id, block);
    const avail = await call("GET", "/api/roster/availability?from=2026-12-01&to=2026-12-07");
    const availB = (avail.json.carers ?? []).find((c: Json) => c.carer_id === carerB);
    expect("availability shows the block", availB?.unavailability?.length === 1, availB);
    expect("availability shows working hours", (avail.json.carers ?? []).find((c: Json) => c.carer_id === carerA)?.working_hours?.mon?.length === 1);
    const delBlock = await call("DELETE", `/api/roster/carers/${carerB}/unavailability/${block.json.block?.id}`);
    expect("delete unavailability", delBlock.status === 200, delBlock);

    // ── single visit: create, list, filters ──
    section("Visits: create, list, filter");
    const v1 = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-12-01", start_time: "09:00", end_time: "10:00", required_skills: ["smoke_hoist"], notes: "First smoke visit" });
    expect("create a single draft visit (201)", v1.status === 201 && v1.json.count === 1 && !v1.json.series_id, v1);
    const v1id = v1.json.ids?.[0] as string;
    const row1 = (await listDay("2026-12-01"))?.find((v) => v.id === v1id);
    expect("listed as draft + unassigned, 09:00 London", row1?.roster_state === "draft" && row1?.status === "unassigned" && londonHHmm(row1.start_time) === "09:00", row1);
    expect("filter by status", (await listDay("2026-12-01", "2026-12-01", "&status=unassigned")).some((v) => v.id === v1id));
    expect("filter by status excludes others", !(await listDay("2026-12-01", "2026-12-01", "&status=assigned,confirmed")).some((v) => v.id === v1id));
    expect("filter by client", (await listDay("2026-12-01", "2026-12-01", `&client_id=${client}`)).some((v) => v.id === v1id));
    expect("filter by skill", (await listDay("2026-12-01", "2026-12-01", "&skill=smoke_hoist")).some((v) => v.id === v1id));
    expect("filter by roster_state", (await listDay("2026-12-01", "2026-12-01", "&roster_state=published")).every((v) => v.id !== v1id));
    expect("filter by unassigned=true", (await listDay("2026-12-01", "2026-12-01", "&unassigned=true")).some((v) => v.id === v1id));
    expect("GET one visit", (await call("GET", `/api/roster/visits/${v1id}`)).json.visit?.id === v1id);
    const paged = await call("GET", "/api/roster/visits?from=2026-12-01&to=2026-12-31&limit=1");
    expect("pagination reports the total", paged.json.visits?.length === 1 && paged.json.total >= 1 && paged.json.limit === 1, paged.json);

    // ── assignment rules ──
    section("Assignment rules");
    const exA = await call("POST", `/api/roster/visits/${v1id}/assignments`, { carer_id: carerC });
    expect("do-not-pair carer is blocked (409)", exA.status === 409 && codes(exA.json.issues?.[0]?.blocked).includes("EXCLUDED_CARER"), exA);
    const exB = await call("POST", `/api/roster/visits/${v1id}/assignments`, { carer_id: carerC, force: true });
    expect("...and force cannot override a block", exB.status === 409, exB);
    const noSkill = await call("POST", `/api/roster/visits/${v1id}/assignments`, { carer_id: carerB });
    expect("missing skill is overridable (409 without force)", noSkill.status === 409 && codes(noSkill.json.issues?.[0]?.overridable).includes("MISSING_SKILL"), noSkill);
    const forced = await call("POST", `/api/roster/visits/${v1id}/assignments`, { carer_id: carerB, force: true });
    expect("...and force=true assigns", forced.status === 200 && forced.json.assigned?.length === 1, forced);
    expect("visit becomes assigned", (await call("GET", `/api/roster/visits/${v1id}`)).json.visit?.status === "assigned");
    expect("second carer on a single-carer visit is refused (409)", (await call("POST", `/api/roster/visits/${v1id}/assignments`, { carer_id: carerA, force: true })).status === 409);
    expect("unassign", (await call("DELETE", `/api/roster/visits/${v1id}/assignments/${carerB}`)).status === 200);
    expect("visit returns to unassigned", (await call("GET", `/api/roster/visits/${v1id}`)).json.visit?.status === "unassigned");
    const okAssign = await call("POST", `/api/roster/visits/${v1id}/assignments`, { carer_id: carerA });
    expect("qualified carer assigns cleanly", okAssign.status === 200 && okAssign.json.assigned?.length === 1, okAssign);
    expect("assigning again is idempotent", (await call("POST", `/api/roster/visits/${v1id}/assignments`, { carer_id: carerA })).json.already_assigned?.length === 1);

    const v2 = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-12-01", start_time: "09:30", end_time: "10:30", required_skills: ["smoke_hoist"] });
    const v2id = v2.json.ids?.[0] as string;
    const overlap = await call("POST", `/api/roster/visits/${v2id}/assignments`, { carer_id: carerA });
    expect("overlapping visit for the same carer -> 409 OVERLAP", overlap.status === 409 && codes(overlap.json.issues?.[0]?.overridable).includes("OVERLAP"), overlap);
    expect("create with carer_ids that clash -> 409 and nothing is created", (await call("POST", "/api/roster/visits", { client_id: client, date: "2026-12-01", start_time: "09:15", end_time: "09:45", required_skills: ["smoke_hoist"], carer_ids: [carerA] })).status === 409);
    const adj = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-12-01", start_time: "10:00", end_time: "10:30", required_skills: ["smoke_hoist"], carer_ids: [carerA] });
    expect("back-to-back visit is not a clash (create with carer_ids)", adj.status === 201, adj);

    // ── double-up ──
    section("Double-up visit");
    const dbl = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-12-02", start_time: "09:00", end_time: "10:00", required_carers: 2 });
    const dblId = dbl.json.ids?.[0] as string;
    await call("POST", `/api/roster/visits/${dblId}/assignments`, { carer_id: carerA });
    const half = (await call("GET", `/api/roster/visits/${dblId}`)).json.visit;
    expect("one of two carers: still unassigned with 1 open slot", half?.status === "unassigned" && half?.open_slots === 1, half);
    expect("shows in the unassigned list", (await listDay("2026-12-02", "2026-12-02", "&unassigned=true")).some((v) => v.id === dblId));
    await call("POST", `/api/roster/visits/${dblId}/assignments`, { carer_id: carerB });
    const full = (await call("GET", `/api/roster/visits/${dblId}`)).json.visit;
    expect("both carers: assigned, lead is slot 1", full?.status === "assigned" && full?.carers?.length === 2 && full?.carers?.[0]?.carer_id === carerA && full?.carers?.[0]?.slot === 1, full);
    expect("filter by carer finds the second carer too", (await listDay("2026-12-02", "2026-12-02", `&carer_id=${carerB}`)).some((v) => v.id === dblId));
    await call("DELETE", `/api/roster/visits/${dblId}/assignments/${carerA}`);
    const promoted = (await call("GET", `/api/roster/visits/${dblId}`)).json.visit;
    expect("removing the lead promotes the second carer", promoted?.carers?.[0]?.carer_id === carerB && promoted?.carers?.[0]?.slot === 1 && promoted?.status === "unassigned", promoted);
    const shrink = await call("PATCH", `/api/roster/visits/${dblId}`, { required_carers: 1 });
    expect("lowering required carers to what is assigned works", shrink.status === 200 && shrink.json.visit?.status === "assigned", shrink);

    // ── status ──
    section("Status");
    const conf = await call("PATCH", `/api/roster/visits/${dblId}`, { status: "confirmed" });
    expect("confirm a staffed visit", conf.status === 200 && conf.json.visit?.status === "confirmed", conf);
    const bad = await call("PATCH", `/api/roster/visits/${v2id}`, { status: "confirmed" });
    expect("cannot confirm an unstaffed visit (409)", bad.status === 409, bad);
    expect("cannot set 'unassigned' directly on a staffed visit", (await call("PATCH", `/api/roster/visits/${dblId}`, { status: "unassigned" })).status === 409);
    await call("DELETE", `/api/roster/visits/${dblId}/assignments/${carerB}`);
    expect("losing the carer drops 'confirmed'", (await call("GET", `/api/roster/visits/${dblId}`)).json.visit?.status === "unassigned");

    // ── recurrence across the clock change ──
    section("Recurrence across the BST -> GMT change (25 Oct 2026)");
    const dst = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-10-23", start_time: "08:00", end_time: "08:45", recurrence: { frequency: "daily", until_date: "2026-10-27" } });
    expect("daily series creates 5 visits", dst.status === 201 && dst.json.count === 5 && !!dst.json.series_id, dst);
    const dstRows = (await listDay("2026-10-23", "2026-10-28", `&series_id=${dst.json.series_id}`));
    expect("every occurrence is 08:00 London time", dstRows.length === 5 && dstRows.every((v) => londonHHmm(v.start_time) === "08:00"), dstRows.map((v) => v.start_time));
    expect("...which is 07:00Z before the change and 08:00Z after", dstRows[1]?.start_time?.startsWith("2026-10-24T07:00") && dstRows[3]?.start_time?.startsWith("2026-10-26T08:00"), dstRows.map((v) => v.start_time));
    await call("DELETE", `/api/roster/visits/${dstRows[0]?.id}?scope=all`);

    // ── edit scopes on a weekly series ──
    section("Recurring edits: this / this and following / all");
    const wk = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-12-07", start_time: "08:00", end_time: "08:45", recurrence: { frequency: "weekly", until_date: "2026-12-28" } });
    expect("weekly series creates 4 visits", wk.status === 201 && wk.json.count === 4, wk);
    const sid = wk.json.series_id as string;
    const ids = wk.json.ids as string[];
    const series = async () => (await listDay("2026-12-01", "2026-12-31", `&series_id=${sid}`));

    const thisEdit = await call("PATCH", `/api/roster/visits/${ids[1]}`, { scope: "this", start_time: "10:00", end_time: "10:45" });
    expect("edit this one", thisEdit.status === 200 && thisEdit.json.affected?.length === 1, thisEdit);
    expect("...it is now a series exception", thisEdit.json.visit?.is_series_exception === true);
    const follow = await call("PATCH", `/api/roster/visits/${ids[2]}`, { scope: "following", start_time: "09:30", end_time: "10:15" });
    expect("edit this and following", follow.status === 200 && follow.json.affected?.length === 2, follow);
    let rows = await series();
    expect("earlier visit untouched, exception untouched, later two moved", rows.length === 4 && londonHHmm(rows[0].start_time) === "08:00" && londonHHmm(rows[1].start_time) === "10:00" && londonHHmm(rows[2].start_time) === "09:30" && londonHHmm(rows[3].start_time) === "09:30", rows.map((r) => londonHHmm(r.start_time)));
    const all = await call("PATCH", `/api/roster/visits/${ids[0]}`, { scope: "all", notes: "Gate code 1234" });
    rows = await series();
    expect("edit all: notes reach every visit, including the exception", all.status === 200 && rows.length === 4 && rows.every((r) => r.notes === "Gate code 1234"), rows.map((r) => r.notes));
    expect("a date change with scope 'all' -> 400", (await call("PATCH", `/api/roster/visits/${ids[0]}`, { scope: "all", date: "2026-12-08" })).status === 400);
    const pattern = await call("PATCH", `/api/roster/visits/${ids[0]}`, { scope: "all", recurrence: { frequency: "custom", by_weekday: [1, 3] } });
    rows = await series();
    expect("change the pattern (Mondays -> Mondays + Wednesdays) adds the Wednesdays", pattern.status === 200 && rows.length === 7, rows.map((r) => r.occurrence_date));

    const delThis = await call("DELETE", `/api/roster/visits/${rows.find((r) => r.occurrence_date === "2026-12-09")?.id}?scope=this`);
    expect("delete this one", delThis.status === 200 && (await series()).length === 6, delThis);
    const delFollow = await call("DELETE", `/api/roster/visits/${rows.find((r) => r.occurrence_date === "2026-12-14")?.id}?scope=following`);
    expect("delete this and following", delFollow.status === 200 && (await series()).length === 1, delFollow);
    const delAll = await call("DELETE", `/api/roster/visits/${ids[0]}?scope=all`);
    expect("delete all removes the rest and the series", delAll.status === 200 && (await series()).length === 0, delAll);

    // ── bulk ──
    section("Bulk operations");
    const bulkIds: string[] = [];
    for (const t of ["08:00", "11:00", "14:00"]) {
      const r = await call("POST", "/api/roster/visits", { client_id: client, date: "2026-12-03", start_time: t, end_time: `${String(Number(t.slice(0, 2)) + 1).padStart(2, "0")}:00` });
      bulkIds.push(r.json.ids?.[0]);
    }
    const pub = await call("POST", "/api/roster/visits/bulk", { action: "publish", ids: bulkIds });
    expect("bulk publish by ids", pub.status === 200 && pub.json.succeeded === 3, pub);
    expect("...they are published", (await listDay("2026-12-03", "2026-12-03", "&roster_state=published")).length >= 3);
    const unpub = await call("POST", "/api/roster/visits/bulk", { action: "unpublish", filter: { from: "2026-12-03", to: "2026-12-03", client_id: client } });
    expect("bulk unpublish by filter", unpub.status === 200 && unpub.json.succeeded === 3, unpub);
    const conf2 = await call("POST", "/api/roster/visits/bulk", { action: "set_status", ids: bulkIds, status: "confirmed" });
    expect("bulk confirm of unstaffed visits: each fails with a reason", conf2.json.failed === 3 && conf2.json.results?.every((r: Json) => !r.ok && r.error), conf2);
    const dry = await call("POST", "/api/roster/visits/bulk", { action: "assign", ids: bulkIds, carer_id: carerA, dry_run: true });
    expect("bulk assign dry run reports success...", dry.status === 200 && dry.json.dry_run === true && dry.json.succeeded === 3, dry);
    expect("...without changing anything", (await listDay("2026-12-03", "2026-12-03", `&carer_id=${carerA}`)).length === 0);
    const real = await call("POST", "/api/roster/visits/bulk", { action: "assign", ids: bulkIds, carer_id: carerA });
    expect("bulk assign", real.status === 200 && real.json.succeeded === 3, real);
    const conf3 = await call("POST", "/api/roster/visits/bulk", { action: "set_status", ids: bulkIds, status: "confirmed" });
    expect("bulk confirm of staffed visits", conf3.json.succeeded === 3, conf3);
    const upd = await call("POST", "/api/roster/visits/bulk", { action: "update", ids: bulkIds, changes: { notes: "Bulk note" } });
    expect("bulk update", upd.json.succeeded === 3 && (await listDay("2026-12-03", "2026-12-03", `&carer_id=${carerA}`)).every((v) => v.notes === "Bulk note"), upd);
    const un = await call("POST", "/api/roster/visits/bulk", { action: "unassign", ids: bulkIds, carer_id: carerA });
    expect("bulk unassign", un.json.succeeded === 3 && (await listDay("2026-12-03", "2026-12-03", `&carer_id=${carerA}`)).length === 0, un);
    const mixed = await call("POST", "/api/roster/visits/bulk", { action: "publish", ids: [...bulkIds.slice(0, 1), crypto.randomUUID()] });
    expect("bulk reports unknown ids per visit", mixed.json.succeeded === 1 && mixed.json.failed === 1, mixed);
    expect("bulk needs exactly one of ids / filter", (await call("POST", "/api/roster/visits/bulk", { action: "publish" })).status === 400);
    const del = await call("POST", "/api/roster/visits/bulk", { action: "delete", ids: bulkIds });
    expect("bulk delete", del.json.succeeded === 3 && (await listDay("2026-12-03", "2026-12-03", `&client_id=${client}`)).length === 0, del);

    // ── legacy endpoints keep working and stay consistent ──
    section("Existing /api/shifts endpoints still work");
    const legacy = await call("POST", "/api/shifts", { client_id: client, carer_id: carerA, start_time: "2026-12-09T14:00:00", end_time: "2026-12-09T15:00:00" });
    expect("legacy create with a carer", legacy.status === 200, legacy);
    const legacyRow = (await listDay("2026-12-09")).find((v) => v.client_id === client);
    expect("...shows in the roster as assigned with a lead assignment", legacyRow?.status === "assigned" && legacyRow?.carers?.[0]?.carer_id === carerA, legacyRow);
    const legacyDone = await call("PATCH", `/api/shifts/${legacyRow?.id}`, { status: "completed" });
    expect("legacy status update", legacyDone.status === 200 && (await call("GET", `/api/roster/visits/${legacyRow?.id}`)).json.visit?.status === "completed", legacyDone);
    const startedEdit = await call("PATCH", `/api/roster/visits/${legacyRow?.id}`, { start_time: "10:00", end_time: "11:00" });
    expect("a completed visit cannot be rescheduled (409)", startedEdit.status === 409, startedEdit);
    expect("a completed visit cannot be deleted (409)", (await call("DELETE", `/api/roster/visits/${legacyRow?.id}`)).status === 409);
  } finally {
    section("Cleaning up");
    const del = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await p;
      console.log(`  ${error ? "FAILED" : "ok    "} ${label}${error ? `: ${error.message}` : ""}`);
    };
    if (created.clientIds.length) await del("smoke client (and its visits)", db.from("clients").delete().in("id", created.clientIds));
    if (created.carerIds.length) await del("smoke carers", db.from("carers").delete().in("id", created.carerIds));
    if (created.skillIds.length) await del("smoke skill", db.from("skills").delete().in("id", created.skillIds));
    await del(
      settingsBefore ? "matching weights restored" : "matching weights removed (there were none before)",
      settingsBefore ? db.from("roster_settings").upsert(settingsBefore, { onConflict: "org_id" }) : db.from("roster_settings").delete().eq("org_id", ORG!),
    );
    if (created.orgIds.length) await del("second organisation", db.from("organizations").delete().in("id", created.orgIds));
    if (created.userId) {
      await del("temporary admin row", db.from("admins").delete().eq("id", created.userId));
      const r = await db.auth.admin.deleteUser(created.userId);
      console.log(`  ${r.error ? "FAILED" : "ok    "} temporary auth user${r.error ? `: ${r.error.message}` : ""}`);
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failed:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nSmoke test aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
