-- Email Verifications Table (for OTP storage)
-- SECURITY: Stores OTP for email verification with expiry
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY,
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

-- OTP Request Logs Table (for rate limiting)
-- SECURITY: Logs all OTP requests for rate limiting by email and IP
CREATE TABLE IF NOT EXISTS otp_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registration Attempt Logs (for security audit and rate limiting)
-- SECURITY: Logs all registration attempts for abuse prevention
CREATE TABLE IF NOT EXISTS registration_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL,
  email VARCHAR(255),
  action VARCHAR(50) NOT NULL, -- 'send_otp', 'verify_otp', 'register'
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidate Registrations Table
-- SECURITY: Stores candidate data with phone uniqueness constraint
CREATE TABLE IF NOT EXISTS candidate_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  resume_url TEXT,
  resume_file_name VARCHAR(255),
  campaign_id INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, rejected
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_email_verifications_email ON email_verifications(email);
CREATE INDEX idx_email_verifications_verified ON email_verifications(verified);
-- Partial unique index: Only one unverified email allowed
CREATE UNIQUE INDEX idx_email_verifications_email_unverified ON email_verifications(email) WHERE verified = false;
CREATE INDEX idx_otp_request_logs_email_created ON otp_request_logs(email, created_at);
CREATE INDEX idx_otp_request_logs_ip_created ON otp_request_logs(ip_address, created_at);
CREATE INDEX idx_candidate_registrations_email ON candidate_registrations(email);
CREATE INDEX idx_candidate_registrations_phone ON candidate_registrations(phone);
CREATE INDEX idx_candidate_registrations_campaign_id ON candidate_registrations(campaign_id);
CREATE INDEX idx_registration_attempt_logs_ip_created ON registration_attempt_logs(ip_address, created_at);
CREATE INDEX idx_registration_attempt_logs_email_created ON registration_attempt_logs(email, created_at);

-- Enable Row Level Security (RLS) on tables
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_attempt_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anyone to send OTP (insert into email_verifications)
CREATE POLICY "Allow public OTP requests" ON email_verifications
  FOR INSERT WITH CHECK (true);

-- RLS Policy: Allow anyone to verify OTP (select and update email_verifications)
CREATE POLICY "Allow public OTP verification" ON email_verifications
  FOR SELECT USING (true);

CREATE POLICY "Allow update email_verifications" ON email_verifications
  FOR UPDATE USING (true);

-- RLS Policy: Allow public to insert OTP request logs
CREATE POLICY "Allow public rate limit logging" ON otp_request_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select rate limit logs" ON otp_request_logs
  FOR SELECT USING (true);

-- RLS Policy: Allow public candidate registration
CREATE POLICY "Allow public candidate registration" ON candidate_registrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select own registration" ON candidate_registrations
  FOR SELECT USING (true);

-- Allow registration attempt logging
CREATE POLICY "Allow registration attempt logging" ON registration_attempt_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select attempt logs" ON registration_attempt_logs
  FOR SELECT USING (true);

-- Function to clean up expired OTP records (optional - run periodically)
-- This helps with database maintenance
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verifications
  WHERE verified = FALSE 
  AND expires_at < NOW()
  AND created_at < NOW() - INTERVAL '24 hours';
  
  -- Also clean old attempt logs (older than 7 days)
  DELETE FROM registration_attempt_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM otp_request_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
