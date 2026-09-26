-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/qkaqhgbajlqofilyqnix/sql/new

-- Drop ONLY the recursive admin policies (root cause)
DROP POLICY IF EXISTS "Admins can read own record" ON admins;
DROP POLICY IF EXISTS "Admins can read org colleagues" ON admins;

-- Add safe admin policy
CREATE POLICY "Any authenticated can read admins" ON admins
  FOR SELECT USING (auth.role() = 'authenticated');

-- Recreate ALL dependent table policies to use the safe pattern
DROP POLICY IF EXISTS "Admins can manage carers" ON carers;
DROP POLICY IF EXISTS "Admins can manage clients" ON clients;
DROP POLICY IF EXISTS "Admins can manage documents" ON documents;
DROP POLICY IF EXISTS "Admins can manage document_types" ON document_types;
DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can manage medications" ON medications;
DROP POLICY IF EXISTS "Admins can manage medication_logs" ON medication_logs;
DROP POLICY IF EXISTS "Admins can manage care_plans" ON care_plans;
DROP POLICY IF EXISTS "Admins can manage assessments" ON assessments;
DROP POLICY IF EXISTS "Admins can manage handover_notes" ON handover_notes;
DROP POLICY IF EXISTS "Admins can manage absences" ON absences;
DROP POLICY IF EXISTS "Admins can manage audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can manage applications" ON applications;

DROP POLICY IF EXISTS "Admins can read document_types" ON document_types;

CREATE POLICY "Admins can manage carers" ON carers
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = carers.org_id));

CREATE POLICY "Admins can manage clients" ON clients
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = clients.org_id));

CREATE POLICY "Admins can manage documents" ON documents
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = documents.org_id));

CREATE POLICY "Admins can manage document_types" ON document_types
  FOR SELECT USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can manage tasks" ON tasks
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = tasks.org_id));

CREATE POLICY "Admins can manage medications" ON medications
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = medications.org_id));

CREATE POLICY "Admins can manage medication_logs" ON medication_logs
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = medication_logs.org_id));

CREATE POLICY "Admins can manage care_plans" ON care_plans
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = care_plans.org_id));

CREATE POLICY "Admins can manage assessments" ON assessments
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = assessments.org_id));

CREATE POLICY "Admins can manage handover_notes" ON handover_notes
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = handover_notes.org_id));

CREATE POLICY "Admins can manage absences" ON absences
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = absences.org_id));

CREATE POLICY "Admins can manage audit_logs" ON audit_logs
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = audit_logs.org_id));

CREATE POLICY "Admins can manage applications" ON applications
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = applications.org_id));
