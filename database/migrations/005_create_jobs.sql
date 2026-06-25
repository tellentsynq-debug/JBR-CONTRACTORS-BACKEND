-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  company_or_warehouse TEXT,
  hourly_rate NUMERIC(10,2),
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  full_address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_jobs_campaign_name ON jobs (campaign_name);
CREATE INDEX IF NOT EXISTS idx_jobs_role_title ON jobs (role_title);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs (is_active);
