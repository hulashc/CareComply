-- Baseline for the PGlite migration test: the Supabase pieces and the tables that were created
-- in the Supabase dashboard (so they are in no migration file). Columns follow
-- lib/database.types.ts before migration 022. Test-only; never run against a real project.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE admins (
  id uuid PRIMARY KEY,
  full_name text,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role text,
  is_superadmin boolean NOT NULL DEFAULT false
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  dob date,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  care_notes text,
  photo_url text,
  gender text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE carers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'carer',
  start_date date,
  status text DEFAULT 'active',
  notes text,
  auth_id uuid,
  created_at timestamptz DEFAULT now()
);
