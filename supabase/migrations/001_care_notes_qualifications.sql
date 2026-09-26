CREATE TABLE IF NOT EXISTS care_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  carer_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'observation',
  note_text text NOT NULL,
  mood text,
  fluids text,
  nutrition text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carer_id uuid NOT NULL REFERENCES carers(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  qualification_type text NOT NULL,
  status text NOT NULL DEFAULT 'valid',
  issued_date date,
  expiry_date date,
  certificate_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE care_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;
