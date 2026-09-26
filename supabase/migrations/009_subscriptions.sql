ALTER TABLE organizations
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN subscription_id TEXT,
ADD COLUMN subscription_status TEXT DEFAULT 'trialing',
ADD COLUMN trial_ends_at TIMESTAMPTZ,
ADD COLUMN seats_purchased INTEGER DEFAULT 0;
