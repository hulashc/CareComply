-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/qkaqhgbajlqofilyqnix/sql/new
-- Adds carer-level RLS policies so carers can read their own data on the carer portal.
-- Each policy links the table to the authenticated user via carers.auth_id.

-- Carers: allow carer to read own record
DROP POLICY IF EXISTS "Carers can read own record" ON carers;
CREATE POLICY "Carers can read own record" ON carers
  FOR SELECT USING (auth.uid() = auth_id);

-- Shifts: allow carer to read shifts assigned to them
DROP POLICY IF EXISTS "Carers can read own shifts" ON shifts;
CREATE POLICY "Carers can read own shifts" ON shifts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carers WHERE carers.id = shifts.carer_id AND carers.auth_id = auth.uid())
  );

-- Tasks: allow carer to read tasks assigned to them
DROP POLICY IF EXISTS "Carers can read own tasks" ON tasks;
CREATE POLICY "Carers can read own tasks" ON tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carers WHERE carers.id = tasks.carer_id AND carers.auth_id = auth.uid())
  );

-- Handover notes: allow carer to read handovers where they are the sender or receiver
DROP POLICY IF EXISTS "Carers can read own handovers" ON handover_notes;
CREATE POLICY "Carers can read own handovers" ON handover_notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carers WHERE carers.id = handover_notes.to_carer_id AND carers.auth_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM carers WHERE carers.id = handover_notes.from_carer_id AND carers.auth_id = auth.uid())
  );

-- Care notes: allow carer to read care notes they authored
DROP POLICY IF EXISTS "Carers can read own care notes" ON care_notes;
CREATE POLICY "Carers can read own care notes" ON care_notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carers WHERE carers.id = care_notes.carer_id AND carers.auth_id = auth.uid())
  );

-- Incidents: allow carer to read incidents they reported
DROP POLICY IF EXISTS "Carers can read own incidents" ON incidents;
CREATE POLICY "Carers can read own incidents" ON incidents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carers WHERE carers.id = incidents.carer_id AND carers.auth_id = auth.uid())
  );

-- Clients: allow carer to read clients they are assigned to (via shifts)
DROP POLICY IF EXISTS "Carers can read assigned clients" ON clients;
CREATE POLICY "Carers can read assigned clients" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shifts
      JOIN carers ON carers.id = shifts.carer_id
      WHERE carers.auth_id = auth.uid()
      AND shifts.client_id = clients.id
    )
    OR
    EXISTS (
      SELECT 1 FROM tasks
      JOIN carers ON carers.id = tasks.carer_id
      WHERE carers.auth_id = auth.uid()
      AND tasks.client_id = clients.id
    )
  );

-- Medications: allow carer to read medications for their assigned clients
DROP POLICY IF EXISTS "Carers can read assigned medications" ON medications;
CREATE POLICY "Carers can read assigned medications" ON medications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shifts
      JOIN carers ON carers.id = shifts.carer_id
      WHERE carers.auth_id = auth.uid()
      AND shifts.client_id = medications.client_id
    )
  );

-- Care plans: allow carer to read care plans for their assigned clients
DROP POLICY IF EXISTS "Carers can read assigned care plans" ON care_plans;
CREATE POLICY "Carers can read assigned care plans" ON care_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shifts
      JOIN carers ON carers.id = shifts.carer_id
      WHERE carers.auth_id = auth.uid()
      AND shifts.client_id = care_plans.client_id
    )
  );

-- Absences: allow carer to read their own absences
DROP POLICY IF EXISTS "Carers can read own absences" ON absences;
CREATE POLICY "Carers can read own absences" ON absences
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carers WHERE carers.id = absences.carer_id AND carers.auth_id = auth.uid())
  );
