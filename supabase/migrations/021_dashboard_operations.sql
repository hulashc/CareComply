-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/qkaqhgbajlqofilyqnix/sql/new
-- Dashboard operations grid: actual visit times on shifts, supporting indexes, and two
-- org-scoped views (unassigned shifts, carer double-bookings). Safe to re-run.

-- ── Actual visit times (recorded by carer check-in / check-out) ─────────────
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS actual_start timestamptz;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS actual_end timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_actual_times' AND conrelid = 'public.shifts'::regclass
  ) THEN
    ALTER TABLE shifts ADD CONSTRAINT valid_actual_times
      CHECK (actual_start IS NULL OR actual_end IS NULL OR actual_end > actual_start);
  END IF;
END $$;

-- ── Indexes for dashboard queries ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shifts_org_start ON shifts (org_id, start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_carer_start ON shifts (carer_id, start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_unassigned ON shifts (org_id, start_time) WHERE carer_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_absences_pending ON absences (org_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_qualifications_org_expiry ON qualifications (org_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_care_plans_org_review ON care_plans (org_id, review_date);
CREATE INDEX IF NOT EXISTS idx_tasks_open_due ON tasks (org_id, due_date) WHERE status <> 'completed';

-- ── Views ──────────────────────────────────────────────────────────────────
-- security_invoker = true: the caller's RLS on shifts applies, so these views add no new
-- access path and need no policies of their own (and no SECURITY DEFINER recursion risk).

-- Shifts with no carer that have not yet ended.
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
  s.notes
FROM shifts s
WHERE s.carer_id IS NULL
  AND s.status <> 'cancelled'
  AND s.end_time > now();

-- Pairs of overlapping shifts for the same carer. Ranges are half-open [start, end),
-- so back-to-back visits (one ends 10:00, next starts 10:00) are NOT conflicts.
CREATE OR REPLACE VIEW v_carer_shift_conflicts
WITH (security_invoker = true) AS
SELECT
  a.org_id,
  a.carer_id,
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
FROM shifts a
JOIN shifts b
  ON b.carer_id = a.carer_id
 AND b.org_id IS NOT DISTINCT FROM a.org_id
 AND a.id < b.id
 AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(b.start_time, b.end_time, '[)')
WHERE a.carer_id IS NOT NULL
  AND a.status <> 'cancelled'
  AND b.status <> 'cancelled';

REVOKE ALL ON v_unassigned_shifts FROM anon;
REVOKE ALL ON v_carer_shift_conflicts FROM anon;
GRANT SELECT ON v_unassigned_shifts TO authenticated;
GRANT SELECT ON v_carer_shift_conflicts TO authenticated;
