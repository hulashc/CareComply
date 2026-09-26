-- Super-admin support
-- Run this in Supabase SQL Editor

-- Add super_admin column to admins table
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false;

-- Super-admin policy: can read all organizations
CREATE POLICY "Superadmins can view all organizations" ON organizations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.is_superadmin = true
  ));

-- Super-admin policy: can read all admins
CREATE POLICY "Superadmins can view all admins" ON admins
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admins AS admins2 WHERE admins2.id = auth.uid() AND admins2.is_superadmin = true
  ));

-- Super-admin policy: can update organizations
CREATE POLICY "Superadmins can update organizations" ON organizations
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.is_superadmin = true
  ));
