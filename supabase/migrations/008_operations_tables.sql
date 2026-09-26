CREATE TABLE IF NOT EXISTS handover_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  from_carer_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  to_carer_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  mood text,
  concerns text,
  tasks_completed text,
  tasks_remaining text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carer_id uuid NOT NULL REFERENCES carers(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  absence_type text NOT NULL DEFAULT 'sick_leave',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  approved_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_absence CHECK (end_date >= start_date)
);

ALTER TABLE carers ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}';
ALTER TABLE carers ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;
