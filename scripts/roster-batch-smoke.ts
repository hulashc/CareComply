import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { resolve } from "node:path";

// End-to-end smoke test of POST /api/roster/visits/batch (the endpoint behind every calendar edit,
// undo and redo) against a RUNNING dev server and the real database.
//
//   npm run dev                                                (in another terminal)
//   npx tsx scripts/roster-batch-smoke.ts --org <org id> [--base http://localhost:3000]
//
// Creates a temporary admin, client and carers (visits in December 2026), exercises the endpoint,
// then deletes everything it created.

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
    console.log(`  FAIL  ${name}${detail !== undefined ? `\n          ${JSON.stringify(detail).slice(0, 500)}` : ""}`);
  }
}
const section = (s: string) => console.log(`\n${s}`);

let cookie = "";
async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: Json }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: "manual",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      console.log("  (rate limited, waiting 15s)");
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    let json: Json = {};
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, json };
  }
  throw new Error("rate limited");
}

const batch = (body: Json) => call("POST", "/api/roster/visits/batch", body);
const get = async (id: string) => (await call("GET", `/api/roster/visits/${id}`)).json.visit as Json | undefined;

async function main() {
  if (!ORG) throw new Error("Pass --org <organisation id>");
  const db: SupabaseClient = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const tag = `[roster-batch-smoke ${Date.now()}]`;
  const created = { userId: "", clientIds: [] as string[], carerIds: [] as string[], orgIds: [] as string[] };

  try {
    const email = `roster-batch-smoke-${Date.now()}@roster-demo.test`;
    const password = `Smoke-${crypto.randomUUID()}`;
    const user = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (user.error || !user.data.user) throw new Error(`create admin user: ${user.error?.message}`);
    created.userId = user.data.user.id;
    const adminRow = await db.from("admins").insert({ id: created.userId, org_id: ORG, full_name: "Roster batch smoke", role: "admin" });
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

    const mk = async (table: string, row: Json) => {
      const r = await db.from(table).insert({ org_id: ORG, ...row }).select("id").single();
      if (r.error) throw new Error(`insert ${table}: ${r.error.message}`);
      return r.data.id as string;
    };
    const client = await mk("clients", { full_name: "Batch Client", care_notes: tag });
    const carerA = await mk("carers", { full_name: "Batch Carer A", gender: "Female", notes: tag, status: "active" });
    const carerB = await mk("carers", { full_name: "Batch Carer B", gender: "Male", notes: tag, status: "active" });
    const carerC = await mk("carers", { full_name: "Batch Carer C", gender: "Female", notes: tag, status: "active" });
    created.clientIds.push(client);
    created.carerIds.push(carerA, carerB, carerC);

    const snap = (id: string, start: string, end: string, carers: string[], over: Json = {}) => ({
      id, client_id: client, start_time: start, end_time: end, required_carers: 1, carer_ids: carers, ...over,
    });
    // December 2026 is GMT, so "09:00Z" is 09:00 London.
    const at = (day: string, hhmm: string) => `2026-12-${day}T${hhmm}:00.000Z`;

    // ── create / move / reassign / unassign ──
    section("Create, move, reassign, unassign");
    const id1 = crypto.randomUUID();
    const c1 = await batch({ upserts: [snap(id1, at("07", "09:00"), at("07", "10:00"), [carerA])] });
    expect("create a visit with a client-generated id (200)", c1.status === 200 && c1.json.visits?.[0]?.id === id1, c1);
    expect("created visit is assigned with the carer", c1.json.visits?.[0]?.status === "assigned" && c1.json.visits?.[0]?.carers?.[0]?.carer_id === carerA, c1.json.visits?.[0]);
    let v = c1.json.visits?.[0] as Json;

    const m1 = await batch({ upserts: [snap(id1, at("07", "09:30"), at("07", "10:30"), [carerA], { updated_at: v.updated_at })] });
    expect("move in time", m1.status === 200 && new Date(m1.json.visits[0].start_time).toISOString() === at("07", "09:30"), m1);
    const old = v;
    v = m1.json.visits[0];

    const stale = await batch({ upserts: [snap(id1, at("07", "11:00"), at("07", "12:00"), [carerA], { updated_at: old.updated_at })] });
    expect("stale version -> 409 STALE", stale.status === 409 && stale.json.code === "STALE" && stale.json.ids?.[0] === id1, stale);
    expect("stale change was not applied", new Date((await get(id1))!.start_time).toISOString() === at("07", "09:30"));

    const r1 = await batch({ upserts: [snap(id1, at("07", "09:30"), at("07", "10:30"), [carerB], { updated_at: v.updated_at })] });
    expect("reassign to another carer", r1.status === 200 && r1.json.visits[0].carers?.[0]?.carer_id === carerB, r1);
    v = r1.json.visits[0];

    const u1 = await batch({ upserts: [snap(id1, at("07", "09:30"), at("07", "10:30"), [], { updated_at: v.updated_at })] });
    expect("unassign returns it to unassigned", u1.status === 200 && u1.json.visits[0].status === "unassigned" && u1.json.visits[0].carers?.length === 0, u1);
    v = u1.json.visits[0];

    // ── conflicts and overrides ──
    section("Conflicts: flagged, overridable with a reason; impossibilities blocked");
    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    await batch({ upserts: [snap(idA, at("08", "09:00"), at("08", "10:00"), [carerA])] });
    const clash = await batch({ upserts: [snap(idB, at("08", "09:30"), at("08", "10:30"), [carerA])] });
    expect("double booking -> 409 OVERRIDE_REQUIRED", clash.status === 409 && clash.json.code === "OVERRIDE_REQUIRED" && clash.json.issues?.[0]?.issues?.[0]?.code === "OVERLAP", clash);
    expect("the rejected visit was not created", (await get(idB)) === undefined);
    const noReason = await batch({ upserts: [snap(idB, at("08", "09:30"), at("08", "10:30"), [carerA])], force: true });
    expect("force without a reason -> 400", noReason.status === 400, noReason);
    const forced = await batch({ upserts: [snap(idB, at("08", "09:30"), at("08", "10:30"), [carerA])], force: true, reason: "Client asked for Carer A" });
    expect("force with a reason succeeds", forced.status === 200 && forced.json.visits?.length === 1, forced);
    expect("override is reported and conflicts are listed", (forced.json.overridden?.length ?? 0) === 1 && (forced.json.conflicts?.length ?? 0) >= 1, { o: forced.json.overridden, c: forced.json.conflicts });

    const leave = await db.from("absences").insert({ org_id: ORG, carer_id: carerC, absence_type: "annual_leave", start_date: "2026-12-10", end_date: "2026-12-11", status: "approved" });
    if (leave.error) throw new Error(`insert absence: ${leave.error.message}`);
    const idL = crypto.randomUUID();
    const onLeave = await batch({ upserts: [snap(idL, at("10", "09:00"), at("10", "10:00"), [carerC])], force: true, reason: "Manager insists" });
    expect("approved leave is BLOCKED even with force", onLeave.status === 409 && onLeave.json.code === "BLOCKED", onLeave);
    expect("blocked visit was not created", (await get(idL)) === undefined);

    // moving a visit that already has the carer onto their leave day is blocked too
    const idM = crypto.randomUUID();
    const okDay = await batch({ upserts: [snap(idM, at("09", "09:00"), at("09", "10:00"), [carerC])] });
    const movedOntoLeave = await batch({ upserts: [snap(idM, at("10", "09:00"), at("10", "10:00"), [carerC], { updated_at: okDay.json.visits?.[0]?.updated_at })] });
    expect("moving a visit onto the carer's leave is BLOCKED", okDay.status === 200 && movedOntoLeave.status === 409 && movedOntoLeave.json.code === "BLOCKED", { okDay, movedOntoLeave });

    // ── double-up ──
    section("Double-up visits");
    const idD = crypto.randomUUID();
    const dbl = await batch({ upserts: [snap(idD, at("14", "09:00"), at("14", "10:00"), [carerA, carerB], { required_carers: 2 })] });
    expect("two carers on one visit", dbl.status === 200 && dbl.json.visits?.[0]?.carers?.length === 2 && dbl.json.visits[0].open_slots === 0, dbl);
    const three = await batch({ upserts: [snap(crypto.randomUUID(), at("14", "11:00"), at("14", "12:00"), [carerA, carerB, carerC], { required_carers: 2 })] });
    expect("three carers -> 400", three.status === 400, three);

    // ── delete and undo-of-delete ──
    section("Delete, and re-create the same id (undo of delete)");
    const gone = await batch({ deletes: [{ id: idD, updated_at: dbl.json.visits[0].updated_at }] });
    expect("delete", gone.status === 200 && gone.json.deleted?.includes(idD) && (await get(idD)) === undefined, gone);
    const back = await batch({ upserts: [snap(idD, at("14", "09:00"), at("14", "10:00"), [carerA, carerB], { required_carers: 2 })] });
    expect("re-create with the same id (undo)", back.status === 200 && back.json.visits?.[0]?.id === idD && back.json.visits[0].carers?.length === 2, back);
    const twice = await batch({ deletes: [{ id: crypto.randomUUID() }] });
    expect("deleting an unknown id is harmless (already_gone)", twice.status === 200 && twice.json.already_gone?.length === 1, twice);

    // ── series occurrence ──
    section("Recurring series: delete one occurrence, move one, undo");
    const series = await call("POST", "/api/roster/visits", {
      client_id: client, date: "2026-12-15", start_time: "08:00", end_time: "09:00", carer_ids: [carerA],
      recurrence: { frequency: "daily", repeat_every: 1, by_weekday: [], until_date: "2026-12-18" },
    });
    const ids: string[] = series.json.ids ?? [];
    expect("series created (4 visits)", series.status === 201 && ids.length === 4, series);
    const occ = (await Promise.all(ids.map(get))).filter(Boolean) as Json[];
    occ.sort((a, b) => a.start_time.localeCompare(b.start_time));
    const second = occ[1];
    const del = await batch({ deletes: [{ id: second.id, updated_at: second.updated_at }] });
    expect("delete one occurrence", del.status === 200 && (await get(second.id)) === undefined, del);
    const undo = await batch({
      upserts: [snap(second.id, second.start_time, second.end_time, [carerA], { series_id: second.series_id, occurrence_date: second.occurrence_date })],
    });
    const restored = await get(second.id);
    expect("undo re-creates it, still in the series as an exception", undo.status === 200 && restored?.series_id === second.series_id && restored?.is_series_exception === true, restored);
    const third = occ[2];
    const moveOcc = await batch({ upserts: [snap(third.id, at("17", "13:00"), at("17", "14:00"), [carerA], { series_id: third.series_id, occurrence_date: third.occurrence_date, updated_at: third.updated_at })] });
    const movedRow = await get(third.id);
    expect("moving an occurrence marks it as an exception", moveOcc.status === 200 && movedRow?.is_series_exception === true, movedRow);
    const moveBack = await batch({ upserts: [snap(third.id, third.start_time, third.end_time, [carerA], { series_id: third.series_id, occurrence_date: third.occurrence_date, updated_at: movedRow?.updated_at })] });
    const backRow = await get(third.id);
    expect("moving it back onto the series time clears the exception (undo)", moveBack.status === 200 && backRow?.is_series_exception === false, backRow);

    // ── started visits and tenancy ──
    section("Started visits, tenancy, atomicity");
    const idS = crypto.randomUUID();
    await batch({ upserts: [snap(idS, at("16", "09:00"), at("16", "10:00"), [carerB])] });
    await db.from("shifts").update({ actual_start: at("16", "09:01"), status: "in_progress" }).eq("id", idS);
    const started = await batch({ upserts: [snap(idS, at("16", "11:00"), at("16", "12:00"), [carerB])] });
    expect("a started visit cannot be moved -> 409 STARTED", started.status === 409 && started.json.code === "STARTED", started);
    const startedDel = await batch({ deletes: [{ id: idS }] });
    expect("a started visit cannot be deleted -> 409", startedDel.status === 409, startedDel);

    const other = await db.from("organizations").insert({ name: `${tag} other org` }).select("id").single();
    created.orgIds.push(other.data!.id);
    const foreign = (await db.from("clients").insert({ org_id: other.data!.id, full_name: "Foreign", care_notes: tag }).select("id").single()).data!.id as string;
    created.clientIds.push(foreign);
    const cross = await batch({ upserts: [{ ...snap(crypto.randomUUID(), at("18", "09:00"), at("18", "10:00"), []), client_id: foreign }] });
    expect("another organisation's client -> 404", cross.status === 404, cross);

    // One bad item must leave the whole batch unapplied.
    const idOk = crypto.randomUUID();
    const mixed = await batch({ upserts: [snap(idOk, at("21", "09:00"), at("21", "10:00"), [carerB]), snap(crypto.randomUUID(), at("10", "09:00"), at("10", "10:00"), [carerC])] });
    expect("a blocked item rejects the whole batch", mixed.status === 409 && (await get(idOk)) === undefined, mixed);

    // ── bulk move (as a multi-select drag sends it) ──
    section("Bulk move");
    const bulkIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const made = await batch({ upserts: bulkIds.map((id, i) => snap(id, at("22", `${String(7 + i).padStart(2, "0")}:00`), at("22", `${String(8 + i).padStart(2, "0")}:00`), [carerA])) });
    const rows = made.json.visits as Json[];
    const shifted = await batch({
      upserts: rows.map((r) => snap(r.id, r.start_time.replace("-22T", "-23T"), r.end_time.replace("-22T", "-23T"), [carerA], { updated_at: r.updated_at })),
    });
    expect("three visits moved to the next day in one request", made.status === 200 && shifted.status === 200 && shifted.json.visits?.length === 3, { made: made.status, shifted });
  } finally {
    section("Cleaning up");
    const del = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await p;
      console.log(`  ${error ? "FAILED" : "ok    "} ${label}${error ? `: ${error.message}` : ""}`);
    };
    if (created.carerIds.length) await del("absences", db_absences(created.carerIds));
    if (created.clientIds.length) await del("batch smoke clients (and their visits)", clientDelete(created.clientIds));
    if (created.carerIds.length) await del("batch smoke carers", carerDelete(created.carerIds));
    if (created.orgIds.length) await del("second organisation", orgDelete(created.orgIds));
    if (created.userId) {
      await del("temporary admin row", adminDelete(created.userId));
      const r = await adminAuth().auth.admin.deleteUser(created.userId);
      console.log(`  ${r.error ? "FAILED" : "ok    "} temporary auth user${r.error ? `: ${r.error.message}` : ""}`);
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failed:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
}

// Cleanup helpers use a fresh service client so they work even if set-up failed part-way.
const adminAuth = () => createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const db_absences = (carers: string[]) => adminAuth().from("absences").delete().in("carer_id", carers);
const clientDelete = (ids: string[]) => adminAuth().from("clients").delete().in("id", ids);
const carerDelete = (ids: string[]) => adminAuth().from("carers").delete().in("id", ids);
const orgDelete = (ids: string[]) => adminAuth().from("organizations").delete().in("id", ids);
const adminDelete = (id: string) => adminAuth().from("admins").delete().eq("id", id);

main().catch((e) => {
  console.error("\nSmoke test aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
