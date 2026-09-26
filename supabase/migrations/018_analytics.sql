-- Analytics and enhanced audit logging
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can read their analytics" ON analytics_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = analytics_events.org_id
  ));

CREATE POLICY "Service role can insert analytics" ON analytics_events
  FOR INSERT WITH CHECK (true);

-- Materialized view for daily compliance metrics
CREATE TABLE IF NOT EXISTS daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  total_carers integer DEFAULT 0,
  total_clients integer DEFAULT 0,
  compliant_carers integer DEFAULT 0,
  open_incidents integer DEFAULT 0,
  documents_compliant integer DEFAULT 0,
  documents_expiring integer DEFAULT 0,
  documents_expired integer DEFAULT 0,
  compliance_score numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, metric_date)
);

ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can read their metrics" ON daily_metrics
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.org_id = daily_metrics.org_id
  ));

CREATE INDEX IF NOT EXISTS idx_analytics_events_org ON analytics_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_date ON daily_metrics(org_id, metric_date DESC);
