-- Rostering, phase 1: data model.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/qkaqhgbajlqofilyqnix/sql/new
-- Idempotent: safe to re-run. Requires migrations 003, 007, 008, 016, 021 and 022.
--
-- Design decisions (details in comments next to each block):
--  * A roster item IS a `shifts` row (one client visit). No parallel table; every existing page,
--    view and carer check-in keeps working.
--  * `shift_assignments` is the source of truth for WHO is on a visit (1-2 carers, slot 1 = lead).
--    `shifts.carer_id` is kept as a mirror of the lead so legacy readers/writers stay correct.
--  * Visit status is derived in the database, so every writer (new API, old form, seed scripts)
--    gets the same answer. Same approach as the document-status trigger in 005.
--  * Recurrence is a `shift_series` template that is materialised into real visits, so each
--    visit can still be edited, assigned or cancelled on its own.

BEGIN;

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- jsonb array -> text[] ('{}' for anything that is not an array). Used by roster_apply_plan.
CREATE OR REPLACE FUNCTION roster_arr_text(j jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(j) = 'array'
              THEN ARRAY(SELECT jsonb_array_elements_text(j))
              ELSE '{}'::text[] END
$$;

-- ── Skills catalogue (org-level) ────────────────────────────────────────────
-- Deliberately separate from `qualifications`, which are compliance certificates. `code` is the
-- stable key stored on carers.skills / shifts.required_skills; `name` can be renamed freely.
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

-- ── Recurrence template ─────────────────────────────────────────────────────
-- start_time is London wall-clock time, so "08:00" stays 08:00 across BST/GMT changes; each
-- occurrence is converted to an instant when it is materialised.
-- daily  = every `repeat_every` days
-- weekly = every `repeat_every` weeks on the weekday of start_date
-- custom = every `repeat_every` weeks on the ISO weekdays in by_weekday (1=Mon .. 7=Sun)
CREATE TABLE IF NOT EXISTS shift_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'custom')),
  repeat_every smallint NOT NULL DEFAULT 1 CHECK (repeat_every BETWEEN 1 AND 52),
  by_weekday smallint[] NOT NULL DEFAULT '{}'
    CHECK (by_weekday <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  start_date date NOT NULL,
  until_date date,                       -- NULL = open-ended (materialised in rolling windows)
  start_time time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
  required_carers smallint NOT NULL DEFAULT 1 CHECK (required_carers BETWEEN 1 AND 2),
  required_skills text[] NOT NULL DEFAULT '{}',
  default_carer_ids uuid[] NOT NULL DEFAULT '{}',   -- regular carer(s): continuity of care
  notes text,
  excluded_dates date[] NOT NULL DEFAULT '{}',      -- "delete this one" on a series
  generated_until date,                             -- last date materialised into shifts
  created_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (frequency <> 'custom' OR cardinality(by_weekday) > 0),
  CHECK (until_date IS NULL OR until_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_shift_series_org ON shift_series (org_id, client_id);

-- ── Carer attributes for matching ───────────────────────────────────────────
-- Reused as-is: gender, address/postcode, driving_licence, has_vehicle, contract_hours.
-- carers.availability (jsonb, unused until now) holds the weekly working hours:
--   {"mon":[{"start":"07:00","end":"14:00"}], "tue":[...], ... "sun":[...]}   (London time)
-- An empty object means "no pattern recorded" and is treated as unrestricted.
ALTER TABLE carers
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transport_mode text
    CHECK (transport_mode IN ('car', 'public_transport', 'bicycle', 'walking')),
  ADD COLUMN IF NOT EXISTS max_weekly_hours numeric
    CHECK (max_weekly_hours IS NULL OR (max_weekly_hours >= 0 AND max_weekly_hours <= 80)),
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS is_smoker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_allergies text[] NOT NULL DEFAULT '{}';

-- ── Client preferences ──────────────────────────────────────────────────────
-- Reused as-is: gender, primary_language, interpreter_needed, allergies, risk_flags.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS preferred_carer_gender text CHECK (preferred_carer_gender IN ('female', 'male')),
  ADD COLUMN IF NOT EXISTS carer_gender_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prefers_non_smoking_carer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pets text[] NOT NULL DEFAULT '{}';

-- ── Visits (shifts) ─────────────────────────────────────────────────────────
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS required_carers smallint NOT NULL DEFAULT 1
    CHECK (required_carers BETWEEN 1 AND 2),
  ADD COLUMN IF NOT EXISTS required_skills text[] NOT NULL DEFAULT '{}',
  -- Default 'published' so legacy writers (old form, seed scripts) behave as before; the roster
  -- API creates drafts explicitly.
  ADD COLUMN IF NOT EXISTS roster_state text NOT NULL DEFAULT 'published'
    CHECK (roster_state IN ('draft', 'published')),
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES shift_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_date date,
  ADD COLUMN IF NOT EXISTS is_series_exception boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE shifts ALTER COLUMN status SET DEFAULT 'unassigned';

-- At most one visit per series per occurrence date: makes materialisation idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_series_occurrence
  ON shifts (series_id, occurrence_date) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_roster ON shifts (org_id, roster_state, start_time);

-- ── Who is on a visit ───────────────────────────────────────────────────────
-- slot 1 = lead carer, slot 2 = second carer on a double-up visit.
CREATE TABLE IF NOT EXISTS shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  carer_id uuid NOT NULL REFERENCES carers(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot IN (1, 2)),
  assigned_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, slot),
  UNIQUE (shift_id, carer_id)
);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_carer ON shift_assignments (carer_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_org ON shift_assignments (org_id);

-- ── Client <-> carer preferences ────────────────────────────────────────────
-- One row per pair, so a carer cannot be both preferred and excluded for the same client.
-- 'excluded' is the do-not-pair list: a hard rule enforced by the assignment check.
CREATE TABLE IF NOT EXISTS client_carer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  carer_id uuid NOT NULL REFERENCES carers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('preferred', 'excluded')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, carer_id)
);
CREATE INDEX IF NOT EXISTS idx_client_carer_prefs_org ON client_carer_preferences (org_id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_carer_prefs_carer ON client_carer_preferences (carer_id);

-- ── Part-day unavailability ─────────────────────────────────────────────────
-- Leave and sick days stay in `absences` (whole days, with approval). This table is for blocks
-- that are not leave: a school run, an appointment, a training half-day.
CREATE TABLE IF NOT EXISTS carer_unavailability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carer_id uuid NOT NULL REFERENCES carers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_carer_unavailability_carer ON carer_unavailability (carer_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_carer_unavailability_org ON carer_unavailability (org_id, starts_at);

-- ── Matching weights ────────────────────────────────────────────────────────
-- Only overrides are stored; the defaults live in code (lib/roster/weights.ts), so adding a new
-- weight later needs no migration and orgs that never customised follow improved defaults.
CREATE TABLE IF NOT EXISTS roster_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(weights) = 'object'),
  updated_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Backfill (before the triggers exist) ────────────────────────────────────
-- Every existing carer_id becomes the lead assignment.
INSERT INTO shift_assignments (org_id, shift_id, carer_id, slot)
SELECT s.org_id, s.id, s.carer_id, 1
FROM shifts s
JOIN carers c ON c.id = s.carer_id AND c.org_id = s.org_id
WHERE s.org_id IS NOT NULL AND s.carer_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Legacy 'scheduled' (and any unknown value) becomes assigned / unassigned.
UPDATE shifts
SET status = CASE WHEN carer_id IS NULL THEN 'unassigned' ELSE 'assigned' END
WHERE status NOT IN ('unassigned', 'assigned', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- Everything that exists today is already live, so it counts as published.
UPDATE shifts SET published_at = created_at WHERE roster_state = 'published' AND published_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_status_check' AND conrelid = 'public.shifts'::regclass
  ) THEN
    ALTER TABLE shifts ADD CONSTRAINT shifts_status_check
      CHECK (status IN ('unassigned', 'assigned', 'confirmed', 'in_progress', 'completed', 'cancelled'));
  END IF;
END $$;

-- ── Triggers: keep assignments, shifts.carer_id and status consistent ───────
-- Re-entrancy guard: the assignment trigger updates shifts, and the shifts trigger edits
-- assignments. A transaction-local flag stops them calling each other forever.

-- Assignment guard: same org, capacity, no moving between visits.
CREATE OR REPLACE FUNCTION roster_assignment_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_shift_org uuid;
  v_required smallint;
  v_carer_org uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.shift_id <> OLD.shift_id THEN
    RAISE EXCEPTION 'ROSTER_BAD_REQUEST: an assignment cannot move to another visit';
  END IF;
  SELECT org_id, required_carers INTO v_shift_org, v_required FROM shifts WHERE id = NEW.shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROSTER_NOT_FOUND: visit % does not exist', NEW.shift_id;
  END IF;
  SELECT org_id INTO v_carer_org FROM carers WHERE id = NEW.carer_id;
  IF v_shift_org IS DISTINCT FROM NEW.org_id OR v_carer_org IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'ROSTER_ORG_MISMATCH: visit, carer and assignment must belong to the same organisation';
  END IF;
  IF NEW.slot > v_required THEN
    RAISE EXCEPTION 'ROSTER_CAPACITY: slot % exceeds the % carer(s) this visit requires', NEW.slot, v_required;
  END IF;
  RETURN NEW;
END $$;

-- After any assignment change: promote slot 2 if the lead left, mirror the lead into
-- shifts.carer_id, and drop 'confirmed' (any staffing change needs re-confirming).
CREATE OR REPLACE FUNCTION roster_assignment_sync() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_shift uuid;
BEGIN
  IF COALESCE(current_setting('roster.syncing', true), '') = 'on' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN v_shift := OLD.shift_id; ELSE v_shift := NEW.shift_id; END IF;

  PERFORM set_config('roster.syncing', 'on', true);
  IF TG_OP = 'DELETE' AND OLD.slot = 1 THEN
    UPDATE shift_assignments SET slot = 1 WHERE shift_id = v_shift AND slot = 2;
  END IF;
  UPDATE shifts
  SET carer_id = (SELECT carer_id FROM shift_assignments WHERE shift_id = v_shift AND slot = 1),
      status = CASE WHEN status = 'confirmed' THEN 'assigned' ELSE status END
  WHERE id = v_shift;
  PERFORM set_config('roster.syncing', 'off', true);
  RETURN NULL;
END $$;

-- Shift BEFORE write: legacy carer_id writes -> assignments, derived status, capacity, timestamps.
CREATE OR REPLACE FUNCTION roster_shift_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_syncing boolean := COALESCE(current_setting('roster.syncing', true), '') = 'on';
  v_assigned int;
  v_was_confirmed boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    v_was_confirmed := OLD.status = 'confirmed';

    -- Legacy writers (old Schedule Shift form, /api/seed, scripts) set carer_id directly. Make
    -- that the lead assignment so the two representations never drift apart.
    IF NOT v_syncing AND NEW.org_id IS NOT NULL AND NEW.carer_id IS DISTINCT FROM OLD.carer_id THEN
      PERFORM set_config('roster.syncing', 'on', true);
      IF NEW.carer_id IS NULL THEN
        DELETE FROM shift_assignments WHERE shift_id = NEW.id AND slot = 1;
        UPDATE shift_assignments SET slot = 1 WHERE shift_id = NEW.id AND slot = 2;
      ELSE
        DELETE FROM shift_assignments WHERE shift_id = NEW.id AND (slot = 1 OR carer_id = NEW.carer_id);
        INSERT INTO shift_assignments (org_id, shift_id, carer_id, slot)
        VALUES (NEW.org_id, NEW.id, NEW.carer_id, 1);
      END IF;
      PERFORM set_config('roster.syncing', 'off', true);
      NEW.carer_id := (SELECT carer_id FROM shift_assignments WHERE shift_id = NEW.id AND slot = 1);
      v_was_confirmed := false;  -- staffing changed
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.org_id IS NULL THEN
    v_assigned := (NEW.carer_id IS NOT NULL)::int;   -- the assignment row is added after insert
  ELSE
    SELECT count(*) INTO v_assigned FROM shift_assignments WHERE shift_id = NEW.id;
    IF NEW.required_carers < v_assigned THEN
      RAISE EXCEPTION 'ROSTER_CAPACITY: % carer(s) are assigned; unassign before lowering required carers to %',
        v_assigned, NEW.required_carers;
    END IF;
  END IF;

  -- assigned / unassigned / confirmed are derived from staffing; in_progress, completed and
  -- cancelled are explicit states and are left alone. 'scheduled' is the pre-rostering name.
  IF NEW.status IN ('scheduled', 'unassigned', 'assigned', 'confirmed') THEN
    IF v_assigned >= NEW.required_carers THEN
      IF NEW.status = 'confirmed' AND (v_was_confirmed OR TG_OP = 'INSERT' OR OLD.status <> 'confirmed') THEN
        NULL;  -- stays confirmed
      ELSE
        NEW.status := 'assigned';
      END IF;
    ELSE
      IF NEW.status = 'confirmed' AND NOT v_was_confirmed THEN
        RAISE EXCEPTION 'ROSTER_NOT_STAFFED: a visit cannot be confirmed until all % required carer(s) are assigned',
          NEW.required_carers;
      END IF;
      NEW.status := 'unassigned';
    END IF;
  END IF;

  IF NEW.roster_state = 'published' THEN
    IF NEW.published_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.roster_state = 'draft') THEN
      NEW.published_at := now();
    END IF;
  ELSE
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END $$;

-- A legacy insert with carer_id set (no assignment row yet) gets its lead assignment here.
CREATE OR REPLACE FUNCTION roster_shift_after_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.carer_id IS NOT NULL AND NEW.org_id IS NOT NULL THEN
    INSERT INTO shift_assignments (org_id, shift_id, carer_id, slot)
    VALUES (NEW.org_id, NEW.id, NEW.carer_id, 1)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_roster_assignment_guard ON shift_assignments;
CREATE TRIGGER trg_roster_assignment_guard
  BEFORE INSERT OR UPDATE ON shift_assignments
  FOR EACH ROW EXECUTE FUNCTION roster_assignment_guard();

DROP TRIGGER IF EXISTS trg_roster_assignment_sync ON shift_assignments;
CREATE TRIGGER trg_roster_assignment_sync
  AFTER INSERT OR UPDATE OR DELETE ON shift_assignments
  FOR EACH ROW EXECUTE FUNCTION roster_assignment_sync();

DROP TRIGGER IF EXISTS trg_roster_shift_before_write ON shifts;
CREATE TRIGGER trg_roster_shift_before_write
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION roster_shift_before_write();

DROP TRIGGER IF EXISTS trg_roster_shift_after_insert ON shifts;
CREATE TRIGGER trg_roster_shift_after_insert
  AFTER INSERT ON shifts
  FOR EACH ROW EXECUTE FUNCTION roster_shift_after_insert();

-- ── Views ───────────────────────────────────────────────────────────────────
-- security_invoker = true, as in 021: the caller's RLS applies. CREATE OR REPLACE keeps the
-- existing columns (dashboard code reads them by name) and only appends.

-- Not fully staffed, not cancelled, not yet over. A half-staffed double-up counts (open_slots = 1).
CREATE OR REPLACE VIEW v_unassigned_shifts
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.org_id,
  s.client_id,
  s.location_id,
  s.start_time,
  s.end_time,
  s.status,
  s.notes,
  s.required_carers - (SELECT count(*) FROM shift_assignments sa WHERE sa.shift_id = s.id) AS open_slots
FROM shifts s
WHERE s.status = 'unassigned'
  AND s.end_time > now();

-- Overlapping visits for the same carer, now over assignments so the SECOND carer on a
-- double-up is checked too. Half-open ranges: back-to-back visits are not conflicts.
CREATE OR REPLACE VIEW v_carer_shift_conflicts
WITH (security_invoker = true) AS
SELECT
  a.org_id,
  aa.carer_id,
  a.id AS shift_a_id,
  a.client_id AS shift_a_client_id,
  a.start_time AS shift_a_start,
  a.end_time AS shift_a_end,
  b.id AS shift_b_id,
  b.client_id AS shift_b_client_id,
  b.start_time AS shift_b_start,
  b.end_time AS shift_b_end,
  GREATEST(a.start_time, b.start_time) AS overlap_start,
  LEAST(a.end_time, b.end_time) AS overlap_end
FROM shift_assignments aa
JOIN shift_assignments bb ON bb.carer_id = aa.carer_id AND aa.shift_id < bb.shift_id
JOIN shifts a ON a.id = aa.shift_id
JOIN shifts b ON b.id = bb.shift_id
WHERE a.status <> 'cancelled'
  AND b.status <> 'cancelled'
  AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(b.start_time, b.end_time, '[)');

-- One row per visit with client name, the carers on it (ordered by slot) and open slots.
-- Backs the roster list endpoint, which filters on these columns.
CREATE OR REPLACE VIEW v_roster_visits
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.org_id,
  s.client_id,
  c.full_name AS client_name,
  s.location_id,
  s.start_time,
  s.end_time,
  s.status,
  s.roster_state,
  s.published_at,
  s.required_carers,
  s.required_skills,
  s.notes,
  s.series_id,
  s.occurrence_date,
  s.is_series_exception,
  s.actual_start,
  s.actual_end,
  s.created_at,
  s.updated_at,
  COALESCE(a.carers, '[]'::jsonb) AS carers,
  s.required_carers - COALESCE(a.n, 0) AS open_slots
FROM shifts s
JOIN clients c ON c.id = s.client_id
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object('carer_id', sa.carer_id, 'slot', sa.slot, 'full_name', ca.full_name)
      ORDER BY sa.slot
    ) AS carers,
    count(*)::int AS n
  FROM shift_assignments sa
  JOIN carers ca ON ca.id = sa.carer_id
  WHERE sa.shift_id = s.id
) a ON true;

REVOKE ALL ON v_unassigned_shifts FROM anon;
REVOKE ALL ON v_carer_shift_conflicts FROM anon;
REVOKE ALL ON v_roster_visits FROM anon;
GRANT SELECT ON v_unassigned_shifts TO authenticated;
GRANT SELECT ON v_carer_shift_conflicts TO authenticated;
GRANT SELECT ON v_roster_visits TO authenticated;

-- ── Atomic plan application ─────────────────────────────────────────────────
-- The API computes what a create / edit / delete should change (series, visits, assignments)
-- and sends it here as one document, so a recurring series or a "this and following" edit
-- either fully applies or not at all. Columns are whitelisted below, every row is scoped to
-- p_org, and the triggers above still enforce capacity and status rules.
-- Errors are raised as 'ROSTER_<CODE>: message' so the API can map them to HTTP statuses.
CREATE OR REPLACE FUNCTION roster_apply_plan(p_org uuid, p_plan jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v jsonb;
  n int;
  expected int;
  v_slot smallint;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  IF p_org IS NULL OR p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'ROSTER_BAD_REQUEST: organisation and plan are required';
  END IF;

  -- 1. Series templates (full-row upsert; the API sends the merged row).
  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'series_upserts', '[]'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM clients WHERE id = (v ->> 'client_id')::uuid AND org_id = p_org) THEN
      RAISE EXCEPTION 'ROSTER_NOT_FOUND: client';
    END IF;
    INSERT INTO shift_series (
      id, org_id, client_id, location_id, frequency, repeat_every, by_weekday, start_date, until_date,
      start_time, duration_minutes, required_carers, required_skills, default_carer_ids, notes,
      excluded_dates, generated_until, created_by
    ) VALUES (
      (v ->> 'id')::uuid, p_org, (v ->> 'client_id')::uuid, NULLIF(v ->> 'location_id', '')::uuid,
      v ->> 'frequency', COALESCE((v ->> 'repeat_every')::smallint, 1),
      roster_arr_text(v -> 'by_weekday')::smallint[], (v ->> 'start_date')::date,
      NULLIF(v ->> 'until_date', '')::date, (v ->> 'start_time')::time,
      (v ->> 'duration_minutes')::int, COALESCE((v ->> 'required_carers')::smallint, 1),
      roster_arr_text(v -> 'required_skills'), roster_arr_text(v -> 'default_carer_ids')::uuid[],
      v ->> 'notes', roster_arr_text(v -> 'excluded_dates')::date[],
      NULLIF(v ->> 'generated_until', '')::date, NULLIF(v ->> 'created_by', '')::uuid
    )
    ON CONFLICT (id) DO UPDATE SET
      location_id = EXCLUDED.location_id, frequency = EXCLUDED.frequency,
      repeat_every = EXCLUDED.repeat_every, by_weekday = EXCLUDED.by_weekday,
      start_date = EXCLUDED.start_date, until_date = EXCLUDED.until_date,
      start_time = EXCLUDED.start_time, duration_minutes = EXCLUDED.duration_minutes,
      required_carers = EXCLUDED.required_carers, required_skills = EXCLUDED.required_skills,
      default_carer_ids = EXCLUDED.default_carer_ids, notes = EXCLUDED.notes,
      excluded_dates = EXCLUDED.excluded_dates, generated_until = EXCLUDED.generated_until,
      updated_at = now()
    WHERE shift_series.org_id = p_org;
  END LOOP;

  -- 2. Deletes. Visits that have started or been checked in are never deleted.
  IF jsonb_typeof(p_plan -> 'shift_deletes') = 'array' AND jsonb_array_length(p_plan -> 'shift_deletes') > 0 THEN
    expected := jsonb_array_length(p_plan -> 'shift_deletes');
    DELETE FROM shifts
    WHERE id = ANY (roster_arr_text(p_plan -> 'shift_deletes')::uuid[])
      AND org_id = p_org
      AND actual_start IS NULL
      AND status NOT IN ('in_progress', 'completed');
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> expected THEN
      RAISE EXCEPTION 'ROSTER_NOT_DELETABLE: % of % visit(s) are missing or already started', expected - n, expected;
    END IF;
    v_counts := v_counts || jsonb_build_object('deleted', n);
  END IF;

  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'series_deletes', '[]'::jsonb)) LOOP
    DELETE FROM shift_series WHERE id = (v #>> '{}')::uuid AND org_id = p_org;
  END LOOP;

  -- 3. Unassign (before updates, so lowering required_carers in the same plan is valid).
  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'assignment_removes', '[]'::jsonb)) LOOP
    DELETE FROM shift_assignments
    WHERE shift_id = (v ->> 'shift_id')::uuid AND carer_id = (v ->> 'carer_id')::uuid AND org_id = p_org;
  END LOOP;

  -- 4. Partial updates: only keys present in the patch are touched.
  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'shift_updates', '[]'::jsonb)) LOOP
    UPDATE shifts s SET
      start_time = CASE WHEN v ? 'start_time' THEN (v ->> 'start_time')::timestamptz ELSE s.start_time END,
      end_time = CASE WHEN v ? 'end_time' THEN (v ->> 'end_time')::timestamptz ELSE s.end_time END,
      location_id = CASE WHEN v ? 'location_id' THEN NULLIF(v ->> 'location_id', '')::uuid ELSE s.location_id END,
      notes = CASE WHEN v ? 'notes' THEN v ->> 'notes' ELSE s.notes END,
      status = CASE WHEN v ? 'status' THEN v ->> 'status' ELSE s.status END,
      roster_state = CASE WHEN v ? 'roster_state' THEN v ->> 'roster_state' ELSE s.roster_state END,
      required_carers = CASE WHEN v ? 'required_carers' THEN (v ->> 'required_carers')::smallint ELSE s.required_carers END,
      required_skills = CASE WHEN v ? 'required_skills' THEN roster_arr_text(v -> 'required_skills') ELSE s.required_skills END,
      is_series_exception = CASE WHEN v ? 'is_series_exception' THEN (v ->> 'is_series_exception')::boolean ELSE s.is_series_exception END,
      occurrence_date = CASE WHEN v ? 'occurrence_date' THEN NULLIF(v ->> 'occurrence_date', '')::date ELSE s.occurrence_date END
    WHERE s.id = (v ->> 'id')::uuid AND s.org_id = p_org;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      RAISE EXCEPTION 'ROSTER_NOT_FOUND: visit %', v ->> 'id';
    END IF;
  END LOOP;

  -- 5. New visits (ids are generated by the API so plans can reference them).
  IF jsonb_typeof(p_plan -> 'shift_inserts') = 'array' AND jsonb_array_length(p_plan -> 'shift_inserts') > 0 THEN
    expected := jsonb_array_length(p_plan -> 'shift_inserts');
    INSERT INTO shifts (
      id, org_id, client_id, location_id, start_time, end_time, status, notes, required_carers,
      required_skills, roster_state, series_id, occurrence_date, is_series_exception, created_by
    )
    SELECT
      r.id, p_org, r.client_id, r.location_id, r.start_time, r.end_time, 'unassigned', r.notes,
      COALESCE(r.required_carers, 1), roster_arr_text(r.required_skills),
      COALESCE(r.roster_state, 'draft'), r.series_id, r.occurrence_date,
      COALESCE(r.is_series_exception, false), r.created_by
    FROM jsonb_to_recordset(p_plan -> 'shift_inserts') AS r(
      id uuid, client_id uuid, location_id uuid, start_time timestamptz, end_time timestamptz,
      notes text, required_carers smallint, required_skills jsonb, roster_state text,
      series_id uuid, occurrence_date date, is_series_exception boolean, created_by uuid
    )
    WHERE EXISTS (SELECT 1 FROM clients c WHERE c.id = r.client_id AND c.org_id = p_org);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> expected THEN
      RAISE EXCEPTION 'ROSTER_NOT_FOUND: client for % visit(s)', expected - n;
    END IF;
    v_counts := v_counts || jsonb_build_object('inserted', n);
  END IF;

  -- 6. Assign. Slot is optional: the lowest free slot is used.
  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'assignment_adds', '[]'::jsonb)) LOOP
    v_slot := NULLIF(v ->> 'slot', '')::smallint;
    IF v_slot IS NULL THEN
      SELECT min(g) INTO v_slot
      FROM generate_series(1, 2) g
      WHERE g NOT IN (SELECT slot FROM shift_assignments WHERE shift_id = (v ->> 'shift_id')::uuid);
      IF v_slot IS NULL THEN
        RAISE EXCEPTION 'ROSTER_CAPACITY: visit % already has two carers', v ->> 'shift_id';
      END IF;
    END IF;
    INSERT INTO shift_assignments (org_id, shift_id, carer_id, slot, assigned_by)
    VALUES (p_org, (v ->> 'shift_id')::uuid, (v ->> 'carer_id')::uuid, v_slot, NULLIF(v ->> 'assigned_by', '')::uuid);
  END LOOP;

  RETURN v_counts;
END $$;

REVOKE ALL ON FUNCTION roster_apply_plan(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION roster_apply_plan(uuid, jsonb) TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Admins manage everything in their org (same shape as 022). The API uses the service role, so
-- these policies are the backstop for direct client access.
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_carer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE carer_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage skills" ON skills;
CREATE POLICY "Admins can manage skills" ON skills
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = skills.org_id));

DROP POLICY IF EXISTS "Admins can manage shift_series" ON shift_series;
CREATE POLICY "Admins can manage shift_series" ON shift_series
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = shift_series.org_id));

DROP POLICY IF EXISTS "Admins can manage shift_assignments" ON shift_assignments;
CREATE POLICY "Admins can manage shift_assignments" ON shift_assignments
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = shift_assignments.org_id));

DROP POLICY IF EXISTS "Admins can manage client_carer_preferences" ON client_carer_preferences;
CREATE POLICY "Admins can manage client_carer_preferences" ON client_carer_preferences
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = client_carer_preferences.org_id));

DROP POLICY IF EXISTS "Admins can manage carer_unavailability" ON carer_unavailability;
CREATE POLICY "Admins can manage carer_unavailability" ON carer_unavailability
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = carer_unavailability.org_id));

DROP POLICY IF EXISTS "Admins can manage roster_settings" ON roster_settings;
CREATE POLICY "Admins can manage roster_settings" ON roster_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = roster_settings.org_id));

-- Carers see their own assignments, and (replacing the 020 policy) only PUBLISHED visits they are
-- assigned to, via assignments so a second carer on a double-up is covered. A draft roster must
-- never leak to carers.
DROP POLICY IF EXISTS "Carers can read own assignments" ON shift_assignments;
CREATE POLICY "Carers can read own assignments" ON shift_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carers WHERE carers.id = shift_assignments.carer_id AND carers.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Carers can read own shifts" ON shifts;
CREATE POLICY "Carers can read own shifts" ON shifts
  FOR SELECT USING (
    shifts.roster_state = 'published'
    AND EXISTS (
      SELECT 1 FROM shift_assignments sa
      JOIN carers ON carers.id = sa.carer_id
      WHERE sa.shift_id = shifts.id AND carers.auth_id = auth.uid()
    )
  );

-- Make PostgREST pick up the new tables, columns, views and function straight away.
NOTIFY pgrst, 'reload schema';

COMMIT;
