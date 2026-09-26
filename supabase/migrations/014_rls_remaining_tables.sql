-- Paste this entire file into your Supabase SQL Editor (https://supabase.com/dashboard/project/qkaqhgbajlqofilyqnix/sql/new)
-- This adds RLS policies for tables that were missing them.
-- Run AFTER the app has been tested with the admin-client workaround.

CREATE POLICY "Admins can manage carers" ON carers
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = carers.org_id));

CREATE POLICY "Admins can manage clients" ON clients
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = clients.org_id));

CREATE POLICY "Admins can manage documents" ON documents
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = documents.org_id));

CREATE POLICY "Admins can manage document_types" ON document_types
  FOR SELECT USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can manage tasks" ON tasks
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = tasks.org_id));

CREATE POLICY "Admins can manage medications" ON medications
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = medications.org_id));

CREATE POLICY "Admins can manage medication_logs" ON medication_logs
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = medication_logs.org_id));

CREATE POLICY "Admins can manage care_plans" ON care_plans
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = care_plans.org_id));

CREATE POLICY "Admins can manage assessments" ON assessments
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = assessments.org_id));

CREATE POLICY "Admins can manage handover_notes" ON handover_notes
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = handover_notes.org_id));

CREATE POLICY "Admins can manage absences" ON absences
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = absences.org_id));

CREATE POLICY "Admins can manage audit_logs" ON audit_logs
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = audit_logs.org_id));

CREATE POLICY "Admins can manage applications" ON applications
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = applications.org_id));
