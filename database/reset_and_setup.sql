-- COMPLETE RESET AND SETUP FOR OTP SYSTEM
-- Run this in Supabase SQL Editor to fix all table issues

-- Step 1: Drop old tables (if they exist)
DROP TABLE IF EXISTS candidate_registrations CASCADE;
DROP TABLE IF EXISTS registration_attempt_logs CASCADE;
DROP TABLE IF EXISTS otp_request_logs CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;

-- Step 2: Create email_verifications table
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  campaign_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create otp_request_logs table
CREATE TABLE otp_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create registration_attempt_logs table
CREATE TABLE registration_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL,
  email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create candidate_registrations table
CREATE TABLE candidate_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  resume_url TEXT,
  resume_file_name VARCHAR(255),
  campaign_id INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create indexes
CREATE INDEX idx_email_verifications_email ON email_verifications(email);
CREATE INDEX idx_email_verifications_verified ON email_verifications(verified);
CREATE UNIQUE INDEX idx_email_verifications_email_unverified ON email_verifications(email) WHERE verified = false;
CREATE INDEX idx_otp_request_logs_email_created ON otp_request_logs(email, created_at);
CREATE INDEX idx_otp_request_logs_ip_created ON otp_request_logs(ip_address, created_at);
CREATE INDEX idx_candidate_registrations_email ON candidate_registrations(email);
CREATE INDEX idx_candidate_registrations_phone ON candidate_registrations(phone);
CREATE INDEX idx_candidate_registrations_campaign_id ON candidate_registrations(campaign_id);
CREATE INDEX idx_registration_attempt_logs_ip_created ON registration_attempt_logs(ip_address, created_at);
CREATE INDEX idx_registration_attempt_logs_email_created ON registration_attempt_logs(email, created_at);

-- Step 7: Enable RLS
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_attempt_logs ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS Policies for email_verifications
CREATE POLICY "Allow public OTP requests" ON email_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public OTP verification" ON email_verifications
  FOR SELECT USING (true);

CREATE POLICY "Allow update email_verifications" ON email_verifications
  FOR UPDATE USING (true);

-- Step 9: Create RLS Policies for otp_request_logs
CREATE POLICY "Allow public rate limit logging" ON otp_request_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select rate limit logs" ON otp_request_logs
  FOR SELECT USING (true);

-- Step 10: Create RLS Policies for candidate_registrations
CREATE POLICY "Allow public candidate registration" ON candidate_registrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select own registration" ON candidate_registrations
  FOR SELECT USING (true);

-- Step 11: Create RLS Policies for registration_attempt_logs
CREATE POLICY "Allow registration attempt logging" ON registration_attempt_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select attempt logs" ON registration_attempt_logs
  FOR SELECT USING (true);

-- Step 12: Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verifications
  WHERE verified = FALSE 
  AND expires_at < NOW()
  AND created_at < NOW() - INTERVAL '24 hours';
  
  DELETE FROM registration_attempt_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM otp_request_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Done! All tables created successfully
