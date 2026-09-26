CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  carer_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  drug_name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  route text NOT NULL DEFAULT 'oral',
  start_date date NOT NULL,
  end_date date,
  prescribed_by text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  carer_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  administered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'given',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  goals text,
  interventions text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  review_date date,
  reviewed_at timestamptz,
  created_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'initial',
  scores jsonb DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'completed',
  assessed_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  next_review_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'none';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS recurrence_end_date date;
