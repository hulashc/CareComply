-- Multi-location support for organizations with branches
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their org locations" ON locations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = locations.org_id
  ));

-- Add location_id to clients, carers, shifts (nullable for backward compatibility)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE carers ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

-- Index for fast location lookups
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_location ON clients(location_id);
CREATE INDEX IF NOT EXISTS idx_carers_location ON carers(location_id);
CREATE INDEX IF NOT EXISTS idx_shifts_location ON shifts(location_id);
