CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  carer_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_times CHECK (end_time > start_time)
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage shifts" ON shifts
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = shifts.org_id));
