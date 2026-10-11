import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Applies the real migration chain to an in-process Postgres (PGlite) on top of a baseline of the
// dashboard-created tables, with legacy rows inserted BEFORE 023 so the backfill is exercised.

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");
const migration = (name: string) => read(`supabase/migrations/${name}`);

const PRIOR = [
  "001_care_notes_qualifications.sql",
  "003_shifts.sql",
  "004_incidents.sql",
  "007_phase1_tables.sql",
  "008_operations_tables.sql",
  "016_multi_location.sql",
  "017_locations_lat_lng.sql",
  "020_carer_rls_policies.sql",
  "021_dashboard_operations.sql",
  "022_client_carer_profiles.sql",
];

let db: PGlite;

type Row = Record<string, unknown>;
async function q<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
async function one<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T> {
  const rows = await q<T>(sql, params);
  if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}: ${sql}`);
  return rows[0];
}

const id = async (sql: string, params: unknown[] = []) => (await one<{ id: string }>(sql, params)).id;
const newOrg = (name = "Org") => id("INSERT INTO organizations (name) VALUES ($1) RETURNING id", [name]);
const newCarer = (org: string, name = "Carer", authId: string | null = null) =>
  id("INSERT INTO carers (org_id, full_name, auth_id) VALUES ($1, $2, $3) RETURNING id", [org, name, authId]);
const newClient = (org: string, name = "Client") =>
  id("INSERT INTO clients (org_id, full_name) VALUES ($1, $2) RETURNING id", [org, name]);

/** Insert a visit on `day` (YYYY-MM-DD) from `start` to `end` UTC hours. */
const newVisit = (
  org: string,
  client: string,
  opts: { day?: string; start?: string; end?: string; carer?: string | null; status?: string; required?: number; state?: string } = {},
) =>
  id(
    `INSERT INTO shifts (org_id, client_id, carer_id, start_time, end_time, status, required_carers, roster_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      org,
      client,
      opts.carer ?? null,
      `${opts.day ?? "2030-01-07"}T${opts.start ?? "09:00"}:00Z`,
      `${opts.day ?? "2030-01-07"}T${opts.end ?? "10:00"}:00Z`,
      opts.status ?? "unassigned",
      opts.required ?? 1,
      opts.state ?? "published",
    ],
  );

const assign = (org: string, shift: string, carer: string, slot: number) =>
  q("INSERT INTO shift_assignments (org_id, shift_id, carer_id, slot) VALUES ($1, $2, $3, $4)", [org, shift, carer, slot]);

const visit = (shift: string) => one<{ status: string; carer_id: string | null }>("SELECT status, carer_id FROM shifts WHERE id = $1", [shift]);
const slots = (shift: string) =>
  q<{ slot: number; carer_id: string }>("SELECT slot, carer_id FROM shift_assignments WHERE shift_id = $1 ORDER BY slot", [shift]);

// Legacy fixtures (inserted before 023 is applied)
const legacy: Record<string, string> = {};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(read("tests/db/baseline.sql"));
  for (const f of PRIOR) await db.exec(migration(f));

  const org = await newOrg("Legacy org");
  const carer = await newCarer(org, "Legacy carer");
  const client = await newClient(org, "Legacy client");
  const ins = (carerId: string | null, status: string, day: string) =>
    id(
      `INSERT INTO shifts (org_id, client_id, carer_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [org, client, carerId, `${day}T09:00:00Z`, `${day}T10:00:00Z`, status],
    );
  Object.assign(legacy, {
    org, carer, client,
    scheduledAssigned: await ins(carer, "scheduled", "2030-02-01"),
    scheduledOpen: await ins(null, "scheduled", "2030-02-02"),
    completed: await ins(carer, "completed", "2030-02-03"),
    cancelled: await ins(null, "cancelled", "2030-02-04"),
    weird: await ins(null, "missed", "2030-02-05"),
  });

  await db.exec(migration("023_rostering.sql"));
  await db.exec("GRANT USAGE ON SCHEMA public TO authenticated, service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("migration 023", () => {
  it("is idempotent: applying it a second time changes nothing and does not error", async () => {
    const before = await one<{ n: string }>("SELECT count(*)::text AS n FROM shift_assignments");
    await db.exec(migration("023_rostering.sql"));
    const after = await one<{ n: string }>("SELECT count(*)::text AS n FROM shift_assignments");
    expect(after.n).toBe(before.n);
  });

  it("backfills legacy rows: lead assignment, new statuses, published", async () => {
    expect(await visit(legacy.scheduledAssigned)).toMatchObject({ status: "assigned", carer_id: legacy.carer });
    expect(await slots(legacy.scheduledAssigned)).toEqual([{ slot: 1, carer_id: legacy.carer }]);
    expect(await visit(legacy.scheduledOpen)).toMatchObject({ status: "unassigned", carer_id: null });
    expect((await visit(legacy.completed)).status).toBe("completed");
    expect((await visit(legacy.cancelled)).status).toBe("cancelled");
    expect((await visit(legacy.weird)).status).toBe("unassigned"); // unknown legacy value
    const pub = await one<{ roster_state: string; published_at: string | null }>(
      "SELECT roster_state, published_at FROM shifts WHERE id = $1", [legacy.scheduledAssigned]);
    expect(pub.roster_state).toBe("published");
    expect(pub.published_at).not.toBeNull();
  });

  it("rejects statuses outside the roster set", async () => {
    await expect(q("UPDATE shifts SET status = 'bogus' WHERE id = $1", [legacy.completed])).rejects.toThrow(/shifts_status_check/);
  });
});

describe("legacy writers stay consistent (old form, /api/seed, scripts)", () => {
  it("insert with carer_id creates the lead assignment and status 'assigned'", async () => {
    const org = await newOrg(); const carer = await newCarer(org); const client = await newClient(org);
    const s = await newVisit(org, client, { carer, status: "scheduled" });
    expect(await visit(s)).toMatchObject({ status: "assigned", carer_id: carer });
    expect(await slots(s)).toEqual([{ slot: 1, carer_id: carer }]);
  });

  it("insert without a carer and status 'scheduled' becomes 'unassigned'", async () => {
    const org = await newOrg(); const client = await newClient(org);
    expect((await visit(await newVisit(org, client, { status: "scheduled" }))).status).toBe("unassigned");
  });

  it("changing carer_id replaces the lead; clearing it unassigns", async () => {
    const org = await newOrg(); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const client = await newClient(org);
    const s = await newVisit(org, client, { carer: a });
    await q("UPDATE shifts SET carer_id = $1 WHERE id = $2", [b, s]);
    expect(await slots(s)).toEqual([{ slot: 1, carer_id: b }]);
    expect(await visit(s)).toMatchObject({ status: "assigned", carer_id: b });
    await q("UPDATE shifts SET carer_id = NULL WHERE id = $1", [s]);
    expect(await slots(s)).toEqual([]);
    expect(await visit(s)).toMatchObject({ status: "unassigned", carer_id: null });
  });

  it("a status update from old code ('scheduled') is mapped, not rejected", async () => {
    const org = await newOrg(); const carer = await newCarer(org); const client = await newClient(org);
    const s = await newVisit(org, client, { carer });
    await q("UPDATE shifts SET status = 'scheduled' WHERE id = $1", [s]);
    expect((await visit(s)).status).toBe("assigned");
  });
});

describe("assignments", () => {
  it("assigning moves a visit to 'assigned' and mirrors the lead into carer_id; unassigning reverts", async () => {
    const org = await newOrg(); const carer = await newCarer(org); const client = await newClient(org);
    const s = await newVisit(org, client);
    await assign(org, s, carer, 1);
    expect(await visit(s)).toMatchObject({ status: "assigned", carer_id: carer });
    await q("DELETE FROM shift_assignments WHERE shift_id = $1", [s]);
    expect(await visit(s)).toMatchObject({ status: "unassigned", carer_id: null });
  });

  it("double-up: stays 'unassigned' with open_slots = 1 until the second carer is added", async () => {
    const org = await newOrg(); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const client = await newClient(org);
    const s = await newVisit(org, client, { required: 2, day: "2031-03-03" });
    await assign(org, s, a, 1);
    expect((await visit(s)).status).toBe("unassigned");
    const open = await one<{ open_slots: number }>("SELECT open_slots FROM v_unassigned_shifts WHERE id = $1", [s]);
    expect(Number(open.open_slots)).toBe(1);
    await assign(org, s, b, 2);
    expect((await visit(s)).status).toBe("assigned");
    expect(await q("SELECT 1 FROM v_unassigned_shifts WHERE id = $1", [s])).toHaveLength(0);
  });

  it("removing the lead of a double-up promotes the second carer", async () => {
    const org = await newOrg(); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const client = await newClient(org);
    const s = await newVisit(org, client, { required: 2 });
    await assign(org, s, a, 1); await assign(org, s, b, 2);
    await q("DELETE FROM shift_assignments WHERE shift_id = $1 AND carer_id = $2", [s, a]);
    expect(await slots(s)).toEqual([{ slot: 1, carer_id: b }]);
    expect(await visit(s)).toMatchObject({ status: "unassigned", carer_id: b });
  });

  it("enforces capacity: no second carer on a single-carer visit", async () => {
    const org = await newOrg(); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const client = await newClient(org);
    const s = await newVisit(org, client, { carer: a });
    await expect(assign(org, s, b, 2)).rejects.toThrow(/ROSTER_CAPACITY/);
  });

  it("refuses to lower required_carers below the carers already assigned", async () => {
    const org = await newOrg(); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const client = await newClient(org);
    const s = await newVisit(org, client, { required: 2 });
    await assign(org, s, a, 1); await assign(org, s, b, 2);
    await expect(q("UPDATE shifts SET required_carers = 1 WHERE id = $1", [s])).rejects.toThrow(/ROSTER_CAPACITY/);
  });

  it("refuses a carer from another organisation", async () => {
    const org = await newOrg(); const other = await newOrg("Other"); const stranger = await newCarer(other);
    const client = await newClient(org);
    const s = await newVisit(org, client);
    await expect(assign(org, s, stranger, 1)).rejects.toThrow(/ROSTER_ORG_MISMATCH/);
  });

  it("refuses the same carer twice on one visit", async () => {
    const org = await newOrg(); const a = await newCarer(org); const client = await newClient(org);
    const s = await newVisit(org, client, { required: 2 });
    await assign(org, s, a, 1);
    await expect(assign(org, s, a, 2)).rejects.toThrow(/duplicate key/);
  });
});

describe("status rules", () => {
  it("cannot confirm an unstaffed visit, can confirm a staffed one", async () => {
    const org = await newOrg(); const a = await newCarer(org); const client = await newClient(org);
    const s = await newVisit(org, client);
    await expect(q("UPDATE shifts SET status = 'confirmed' WHERE id = $1", [s])).rejects.toThrow(/ROSTER_NOT_STAFFED/);
    await assign(org, s, a, 1);
    await q("UPDATE shifts SET status = 'confirmed' WHERE id = $1", [s]);
    expect((await visit(s)).status).toBe("confirmed");
  });

  it("any staffing change drops 'confirmed'", async () => {
    const org = await newOrg(); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const client = await newClient(org);
    const s = await newVisit(org, client, { carer: a });
    await q("UPDATE shifts SET status = 'confirmed' WHERE id = $1", [s]);
    await q("UPDATE shifts SET carer_id = $1 WHERE id = $2", [b, s]); // legacy swap
    expect((await visit(s)).status).toBe("assigned");

    await q("UPDATE shifts SET status = 'confirmed' WHERE id = $1", [s]);
    await q("DELETE FROM shift_assignments WHERE shift_id = $1", [s]);
    expect((await visit(s)).status).toBe("unassigned");
  });

  it("leaves in_progress / completed / cancelled alone when staffing changes", async () => {
    const org = await newOrg(); const a = await newCarer(org); const client = await newClient(org);
    const s = await newVisit(org, client, { carer: a, status: "in_progress" });
    expect((await visit(s)).status).toBe("in_progress");
    await q("DELETE FROM shift_assignments WHERE shift_id = $1", [s]);
    expect((await visit(s)).status).toBe("in_progress");
  });

  it("stamps published_at on publish and clears it for drafts", async () => {
    const org = await newOrg(); const client = await newClient(org);
    const s = await newVisit(org, client, { state: "draft" });
    const draft = await one<{ published_at: string | null }>("SELECT published_at FROM shifts WHERE id = $1", [s]);
    expect(draft.published_at).toBeNull();
    await q("UPDATE shifts SET roster_state = 'published' WHERE id = $1", [s]);
    expect((await one<{ published_at: string | null }>("SELECT published_at FROM shifts WHERE id = $1", [s])).published_at).not.toBeNull();
    await q("UPDATE shifts SET roster_state = 'draft' WHERE id = $1", [s]);
    expect((await one<{ published_at: string | null }>("SELECT published_at FROM shifts WHERE id = $1", [s])).published_at).toBeNull();
  });
});

describe("v_carer_shift_conflicts", () => {
  it("flags overlaps including the second carer of a double-up, but not back-to-back visits", async () => {
    const org = await newOrg(); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const client = await newClient(org);
    const day = "2032-05-05";
    const dbl = await newVisit(org, client, { day, start: "09:00", end: "10:00", required: 2 });
    await assign(org, dbl, a, 1); await assign(org, dbl, b, 2);
    const overlap = await newVisit(org, client, { day, start: "09:30", end: "10:30" });
    await assign(org, overlap, b, 1);               // clashes with the double-up (as the 2nd carer)
    const adjacent = await newVisit(org, client, { day, start: "10:00", end: "11:00" });
    await assign(org, adjacent, a, 1);              // back-to-back: no conflict

    const rows = await q<{ carer_id: string }>("SELECT carer_id FROM v_carer_shift_conflicts WHERE org_id = $1", [org]);
    expect(rows.map((r) => r.carer_id)).toEqual([b]);
  });

  it("ignores cancelled visits", async () => {
    const org = await newOrg(); const a = await newCarer(org); const client = await newClient(org);
    const day = "2032-06-06";
    const x = await newVisit(org, client, { day, carer: a });
    await newVisit(org, client, { day, carer: a, status: "cancelled" });
    expect(await q("SELECT 1 FROM v_carer_shift_conflicts WHERE org_id = $1", [org])).toHaveLength(0);
    expect(x).toBeTruthy();
  });
});

describe("series", () => {
  it("allows one visit per series per occurrence date", async () => {
    const org = await newOrg(); const client = await newClient(org);
    const series = await id(
      `INSERT INTO shift_series (org_id, client_id, frequency, start_date, start_time, duration_minutes)
       VALUES ($1, $2, 'daily', '2033-01-01', '08:00', 30) RETURNING id`, [org, client]);
    const ins = () => q(
      `INSERT INTO shifts (org_id, client_id, start_time, end_time, series_id, occurrence_date)
       VALUES ($1, $2, '2033-01-01T08:00:00Z', '2033-01-01T08:30:00Z', $3, '2033-01-01')`, [org, client, series]);
    await ins();
    await expect(ins()).rejects.toThrow(/uq_shifts_series_occurrence/);
  });

  it("validates custom frequency needs weekdays", async () => {
    const org = await newOrg(); const client = await newClient(org);
    await expect(q(
      `INSERT INTO shift_series (org_id, client_id, frequency, start_date, start_time, duration_minutes)
       VALUES ($1, $2, 'custom', '2033-01-01', '08:00', 30)`, [org, client])).rejects.toThrow();
  });
});

describe("roster_apply_plan", () => {
  it("applies series, visits and assignments atomically", async () => {
    const org = await newOrg(); const client = await newClient(org); const carer = await newCarer(org);
    const seriesId = crypto.randomUUID(); const v1 = crypto.randomUUID(); const v2 = crypto.randomUUID();
    const plan = {
      series_upserts: [{
        id: seriesId, client_id: client, frequency: "daily", repeat_every: 1, by_weekday: [],
        start_date: "2034-01-01", start_time: "08:00", duration_minutes: 30, required_carers: 1,
        required_skills: ["medication"], default_carer_ids: [carer], excluded_dates: [],
      }],
      shift_inserts: [
        { id: v1, client_id: client, start_time: "2034-01-01T08:00:00Z", end_time: "2034-01-01T08:30:00Z", series_id: seriesId, occurrence_date: "2034-01-01", required_skills: ["medication"] },
        { id: v2, client_id: client, start_time: "2034-01-02T08:00:00Z", end_time: "2034-01-02T08:30:00Z", series_id: seriesId, occurrence_date: "2034-01-02" },
      ],
      assignment_adds: [{ shift_id: v1, carer_id: carer }],
    };
    await db.query("SELECT roster_apply_plan($1, $2::jsonb)", [org, JSON.stringify(plan)]);

    expect((await visit(v1))).toMatchObject({ status: "assigned", carer_id: carer });
    expect((await visit(v2)).status).toBe("unassigned");
    const rs = await one<{ roster_state: string; required_skills: string[] }>("SELECT roster_state, required_skills FROM shifts WHERE id = $1", [v1]);
    expect(rs).toEqual({ roster_state: "draft", required_skills: ["medication"] });
  });

  it("rolls everything back when any part fails", async () => {
    const org = await newOrg(); const client = await newClient(org); const a = await newCarer(org, "A"); const b = await newCarer(org, "B");
    const v1 = crypto.randomUUID();
    const plan = {
      shift_inserts: [{ id: v1, client_id: client, start_time: "2035-01-01T08:00:00Z", end_time: "2035-01-01T09:00:00Z" }],
      // second carer on a single-carer visit -> capacity error after the insert succeeded
      assignment_adds: [{ shift_id: v1, carer_id: a, slot: 1 }, { shift_id: v1, carer_id: b, slot: 2 }],
    };
    await expect(db.query("SELECT roster_apply_plan($1, $2::jsonb)", [org, JSON.stringify(plan)])).rejects.toThrow(/ROSTER_CAPACITY/);
    expect(await q("SELECT 1 FROM shifts WHERE id = $1", [v1])).toHaveLength(0);
  });

  it("is scoped to the organisation: cannot touch another org's visit or client", async () => {
    const org = await newOrg(); const other = await newOrg("Other");
    const otherClient = await newClient(other); const otherVisit = await newVisit(other, otherClient);
    await expect(db.query("SELECT roster_apply_plan($1, $2::jsonb)", [org, JSON.stringify({ shift_updates: [{ id: otherVisit, notes: "hijack" }] })]))
      .rejects.toThrow(/ROSTER_NOT_FOUND/);
    await expect(db.query("SELECT roster_apply_plan($1, $2::jsonb)", [org, JSON.stringify({
      shift_inserts: [{ id: crypto.randomUUID(), client_id: otherClient, start_time: "2035-01-01T08:00:00Z", end_time: "2035-01-01T09:00:00Z" }],
    })])).rejects.toThrow(/ROSTER_NOT_FOUND/);
  });

  it("applies partial updates and refuses to delete a started visit", async () => {
    const org = await newOrg(); const client = await newClient(org); const carer = await newCarer(org);
    const s = await newVisit(org, client, { carer });
    await db.query("SELECT roster_apply_plan($1, $2::jsonb)", [org, JSON.stringify({ shift_updates: [{ id: s, notes: "gate code 1234" }] })]);
    const row = await one<{ notes: string; status: string }>("SELECT notes, status FROM shifts WHERE id = $1", [s]);
    expect(row).toEqual({ notes: "gate code 1234", status: "assigned" }); // untouched keys unchanged

    await q("UPDATE shifts SET actual_start = '2030-01-07T09:01:00Z', status = 'in_progress' WHERE id = $1", [s]);
    await expect(db.query("SELECT roster_apply_plan($1, $2::jsonb)", [org, JSON.stringify({ shift_deletes: [s] })]))
      .rejects.toThrow(/ROSTER_NOT_DELETABLE/);
  });

  it("is not executable by anon or authenticated", async () => {
    const org = await newOrg();
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await expect(db.query("SELECT roster_apply_plan($1, '{}'::jsonb)", [org])).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("RESET ROLE");
      }
    }
  });
});

describe("row level security", () => {
  it("a carer sees only PUBLISHED visits they are assigned to (including as second carer)", async () => {
    const org = await newOrg(); const authUser = crypto.randomUUID();
    const me = await newCarer(org, "Me", authUser); const colleague = await newCarer(org, "Colleague");
    const client = await newClient(org);
    const published = await newVisit(org, client, { required: 2, state: "published" });
    await assign(org, published, colleague, 1); await assign(org, published, me, 2);
    const draft = await newVisit(org, client, { carer: me, state: "draft" });
    const notMine = await newVisit(org, client, { carer: colleague, state: "published" });

    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${authUser}', false);`);
    try {
      const seen = (await q<{ id: string }>("SELECT id FROM shifts WHERE org_id = $1", [org])).map((r) => r.id);
      expect(seen).toEqual([published]);
      expect(seen).not.toContain(draft);
      expect(seen).not.toContain(notMine);
    } finally {
      await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);");
    }
  });

  it("an admin can manage roster tables for their own org only", async () => {
    const org = await newOrg(); const other = await newOrg("Other");
    const adminId = crypto.randomUUID();
    await q("INSERT INTO admins (id, org_id) VALUES ($1, $2)", [adminId, org]);
    await q("INSERT INTO skills (org_id, code, name) VALUES ($1, 'hoist', 'Hoist'), ($2, 'hoist', 'Hoist')", [org, other]);

    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${adminId}', false);`);
    try {
      const rows = await q<{ org_id: string }>("SELECT org_id FROM skills");
      expect(rows.map((r) => r.org_id)).toEqual([org]);
    } finally {
      await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);");
    }
  });
});
