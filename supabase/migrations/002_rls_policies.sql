CREATE POLICY "Admins can manage care_notes" ON care_notes
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = care_notes.org_id));

CREATE POLICY "Admins can manage qualifications" ON qualifications
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = qualifications.org_id));
