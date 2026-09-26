-- Allow carers to read their own record for login role detection
CREATE POLICY "Carers can read own record" ON carers
  FOR SELECT USING (auth.uid() = auth_id);
