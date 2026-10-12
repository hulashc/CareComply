-- ============================================================================
-- DEV ONLY: demo data for the dashboard operations grid. DO NOT RUN IN PRODUCTION.
-- ============================================================================
-- Prereqs: migration 021 applied; the org already has >= 2 carers and >= 3 clients
-- (e.g. via the dashboard "Seed demo data" button).
--
-- Usage: replace <YOUR_ORG_ID> below, then paste into the Supabase SQL Editor of a
-- DEV project. Rows are tagged with '[demo-dashboard]' so they can be removed with the
-- cleanup block at the bottom.
-- ============================================================================

DO $$
DECLARE
  v_org     uuid := '<YOUR_ORG_ID>';
  -- Midnight today, Europe/London wall-clock (timestamp without tz)
  v_today   timestamp := date_trunc('day', now() AT TIME ZONE 'Europe/London');
  v_carers  uuid[];
  v_clients uuid[];
  tag       text := '[demo-dashboard]';
BEGIN
  SELECT array_agg(id ORDER BY full_name) INTO v_carers FROM carers WHERE org_id = v_org;
  SELECT array_agg(id ORDER BY full_name) INTO v_clients FROM clients WHERE org_id = v_org;

  IF coalesce(array_length(v_carers, 1), 0) < 2 OR coalesce(array_length(v_clients, 1), 0) < 3 THEN
    RAISE EXCEPTION 'Org % needs at least 2 carers and 3 clients', v_org;
  END IF;

  -- Today's diary (London times converted to timestamptz)
  INSERT INTO shifts (org_id, client_id, carer_id, start_time, end_time, status, notes,
                      actual_start, actual_end) VALUES
    -- On time, completed
    (v_org, v_clients[1], v_carers[1],
     (v_today + interval '07:30') AT TIME ZONE 'Europe/London',
     (v_today + interval '08:30') AT TIME ZONE 'Europe/London', 'completed', tag || ' Morning call',
     (v_today + interval '07:32') AT TIME ZONE 'Europe/London',
     (v_today + interval '08:28') AT TIME ZONE 'Europe/London'),
    -- Late start (25 min) and short (30 of 60 min)
    (v_org, v_clients[2], v_carers[2],
     (v_today + interval '09:00') AT TIME ZONE 'Europe/London',
     (v_today + interval '10:00') AT TIME ZONE 'Europe/London', 'completed', tag || ' Personal care',
     (v_today + interval '09:25') AT TIME ZONE 'Europe/London',
     (v_today + interval '09:55') AT TIME ZONE 'Europe/London'),
    -- Double-booking: carer 1 has two overlapping visits
    (v_org, v_clients[2], v_carers[1],
     (v_today + interval '12:00') AT TIME ZONE 'Europe/London',
     (v_today + interval '13:00') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Lunch call',
     NULL, NULL),
    (v_org, v_clients[3], v_carers[1],
     (v_today + interval '12:30') AT TIME ZONE 'Europe/London',
     (v_today + interval '13:30') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Medication round',
     NULL, NULL),
    -- Back-to-back (NOT a conflict)
    (v_org, v_clients[1], v_carers[2],
     (v_today + interval '17:00') AT TIME ZONE 'Europe/London',
     (v_today + interval '18:00') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Tea call',
     NULL, NULL),
    (v_org, v_clients[3], v_carers[2],
     (v_today + interval '18:00') AT TIME ZONE 'Europe/London',
     (v_today + interval '19:00') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Evening call',
     NULL, NULL),
    -- Unassigned tonight
    (v_org, v_clients[1], NULL,
     (v_today + interval '21:00') AT TIME ZONE 'Europe/London',
     (v_today + interval '21:45') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Bedtime call',
     NULL, NULL);

  -- Tomorrow's diary (one unassigned gap)
  INSERT INTO shifts (org_id, client_id, carer_id, start_time, end_time, status, notes) VALUES
    (v_org, v_clients[1], v_carers[1],
     (v_today + interval '1 day 07:30') AT TIME ZONE 'Europe/London',
     (v_today + interval '1 day 08:30') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Morning call'),
    (v_org, v_clients[2], NULL,
     (v_today + interval '1 day 09:00') AT TIME ZONE 'Europe/London',
     (v_today + interval '1 day 10:00') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Personal care'),
    (v_org, v_clients[3], v_carers[2],
     (v_today + interval '1 day 13:00') AT TIME ZONE 'Europe/London',
     (v_today + interval '1 day 14:00') AT TIME ZONE 'Europe/London', 'scheduled', tag || ' Lunch call');

  -- Pending time off
  INSERT INTO absences (org_id, carer_id, absence_type, start_date, end_date, status, reason) VALUES
    (v_org, v_carers[1], 'holiday', (v_today + interval '10 days')::date, (v_today + interval '14 days')::date,
     'pending', tag || ' Family wedding'),
    (v_org, v_carers[2], 'sick_leave', (v_today + interval '1 day')::date, (v_today + interval '2 days')::date,
     'pending', tag || ' Dental surgery');

  -- Training: expired + expiring
  INSERT INTO qualifications (org_id, carer_id, qualification_type, status, issued_date, expiry_date, notes) VALUES
    (v_org, v_carers[1], 'Moving & Handling', 'valid', (v_today - interval '13 months')::date,
     (v_today - interval '1 month')::date, tag),
    (v_org, v_carers[2], 'Moving & Handling', 'valid', (v_today - interval '11 months')::date,
     (v_today + interval '20 days')::date, tag),
    (v_org, v_carers[2], 'Safeguarding Adults', 'valid', (v_today - interval '3 years')::date,
     (v_today - interval '5 days')::date, tag),
    (v_org, v_carers[1], 'First Aid', 'valid', (v_today - interval '35 months')::date,
     (v_today + interval '9 days')::date, tag);

  -- Care plans: one overdue review, one due soon
  INSERT INTO care_plans (org_id, client_id, title, status, review_date, notes) VALUES
    (v_org, v_clients[1], 'Falls prevention plan', 'active', (v_today - interval '6 days')::date, tag),
    (v_org, v_clients[2], 'Nutrition & hydration plan', 'active', (v_today + interval '7 days')::date, tag);

  -- Checklists: overdue + due today + no date
  INSERT INTO tasks (org_id, client_id, carer_id, title, category, priority, status, due_date, description) VALUES
    (v_org, v_clients[1], v_carers[1], 'Update MAR chart', 'medication', 'high', 'pending',
     (v_today - interval '2 days')::date, tag),
    (v_org, v_clients[2], v_carers[2], 'Order continence supplies', 'personal_care', 'medium', 'pending',
     v_today::date, tag),
    (v_org, v_clients[3], NULL, 'Arrange GP review', 'communication', 'low', 'in_progress', NULL, tag);

  -- One open incident this week
  INSERT INTO incidents (org_id, client_id, carer_id, severity, category, title, description, status) VALUES
    (v_org, v_clients[2], v_carers[2], 'medium', 'fall', 'Unwitnessed fall in lounge',
     tag || ' Client found seated on floor; no visible injury. GP informed.', 'open');
END $$;

-- ── Cleanup (DEV ONLY) ──────────────────────────────────────────────────────
-- DELETE FROM shifts         WHERE notes LIKE '[demo-dashboard]%';
-- DELETE FROM absences       WHERE reason LIKE '[demo-dashboard]%';
-- DELETE FROM qualifications WHERE notes = '[demo-dashboard]';
-- DELETE FROM care_plans     WHERE notes = '[demo-dashboard]';
-- DELETE FROM tasks          WHERE description = '[demo-dashboard]';
-- DELETE FROM incidents      WHERE description LIKE '[demo-dashboard]%';
