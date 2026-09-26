CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  carer_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'low',
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text NOT NULL,
  action_taken text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage incidents" ON incidents
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = incidents.org_id));
