ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own record" ON admins
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can read org colleagues" ON admins
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM admins self WHERE self.id = auth.uid() AND self.org_id = admins.org_id));
