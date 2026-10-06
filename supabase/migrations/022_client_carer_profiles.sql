-- Detailed client and carer profiles (UK / CQC oriented).
-- Sensitive carer fields (NI number, bank details) are stored as ciphertext (*_enc),
-- encrypted by the API with AES-256-GCM before insert. Never store them in plaintext.

-- ---------------------------------------------------------------- clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS nhs_number text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS primary_language text,
  ADD COLUMN IF NOT EXISTS interpreter_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS dietary_needs text,
  ADD COLUMN IF NOT EXISTS communication_needs text,
  ADD COLUMN IF NOT EXISTS mobility_level text,
  ADD COLUMN IF NOT EXISTS allergies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dnacpr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capacity_status text,
  ADD COLUMN IF NOT EXISTS consent_to_care boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_to_share boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lpa_holder text,
  ADD COLUMN IF NOT EXISTS advocate text,
  ADD COLUMN IF NOT EXISTS funding_source text,
  ADD COLUMN IF NOT EXISTS funding_ref text,
  ADD COLUMN IF NOT EXISTS local_authority text,
  ADD COLUMN IF NOT EXISTS key_worker_id uuid REFERENCES carers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS life_history text,
  ADD COLUMN IF NOT EXISTS likes text,
  ADD COLUMN IF NOT EXISTS dislikes text,
  ADD COLUMN IF NOT EXISTS access_instructions text;

CREATE INDEX IF NOT EXISTS idx_clients_org_status ON clients(org_id, status);

-- ---------------------------------------------------------------- carers
ALTER TABLE carers
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS ni_number_enc text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS contract_hours numeric,
  ADD COLUMN IF NOT EXISTS pay_grade text,
  ADD COLUMN IF NOT EXISTS probation_end date,
  ADD COLUMN IF NOT EXISTS right_to_work_status text,
  ADD COLUMN IF NOT EXISTS right_to_work_expiry date,
  ADD COLUMN IF NOT EXISTS dbs_number text,
  ADD COLUMN IF NOT EXISTS dbs_level text,
  ADD COLUMN IF NOT EXISTS dbs_issue_date date,
  ADD COLUMN IF NOT EXISTS dbs_update_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driving_licence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_vehicle boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_insured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_declaration text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_sort_code_enc text,
  ADD COLUMN IF NOT EXISTS bank_account_enc text;

-- ---------------------------------------------------------------- child tables
CREATE TABLE IF NOT EXISTS client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('next_of_kin', 'gp', 'professional', 'lpa')),
  name text NOT NULL,
  relationship text,
  phone text,
  email text,
  address text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);

CREATE TABLE IF NOT EXISTS carer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carer_id uuid NOT NULL REFERENCES carers(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  phone text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carer_contacts_carer ON carer_contacts(carer_id);

CREATE TABLE IF NOT EXISTS carer_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carer_id uuid NOT NULL REFERENCES carers(id) ON DELETE CASCADE,
  name text NOT NULL,
  organisation text,
  relationship text,
  phone text,
  email text,
  received boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carer_references_carer ON carer_references(carer_id);

-- ---------------------------------------------------------------- RLS (admins only; carers have no access)
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carer_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage client_contacts" ON client_contacts;
CREATE POLICY "Admins can manage client_contacts" ON client_contacts
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = client_contacts.org_id));

DROP POLICY IF EXISTS "Admins can manage carer_contacts" ON carer_contacts;
CREATE POLICY "Admins can manage carer_contacts" ON carer_contacts
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = carer_contacts.org_id));

DROP POLICY IF EXISTS "Admins can manage carer_references" ON carer_references;
CREATE POLICY "Admins can manage carer_references" ON carer_references
  FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = carer_references.org_id));

-- Backfill the legacy single emergency contact into client_contacts.
INSERT INTO client_contacts (org_id, client_id, type, name, phone, is_primary)
SELECT c.org_id, c.id, 'next_of_kin', c.emergency_contact_name, c.emergency_contact_phone, true
FROM clients c
WHERE c.org_id IS NOT NULL
  AND c.emergency_contact_name IS NOT NULL
  AND c.emergency_contact_name <> ''
  AND NOT EXISTS (SELECT 1 FROM client_contacts cc WHERE cc.client_id = c.id);
