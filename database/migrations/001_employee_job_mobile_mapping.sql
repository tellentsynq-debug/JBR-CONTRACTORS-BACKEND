-- Employee Job Mobile Mapping Table for Chat Application
-- This table maintains the relationship between employees, their job assignments, and mobile numbers for chat functionality

-- Create employee_job_mobile_mapping table
CREATE TABLE IF NOT EXISTS employee_job_mobile_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  candidate_id INTEGER,
  job_category_id INTEGER,
  job_industry_id INTEGER,
  mobile_number VARCHAR(20) NOT NULL,
  mobile_verified BOOLEAN DEFAULT FALSE,
  mobile_verified_at TIMESTAMP WITH TIME ZONE,
  otp VARCHAR(6),
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  otp_attempts INT DEFAULT 0,
  chat_enabled BOOLEAN DEFAULT FALSE,
  chat_verified_at TIMESTAMP WITH TIME ZONE,
  device_token TEXT,
  device_type VARCHAR(50), -- 'android', 'ios', 'web'
  last_active_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT unique_employee_mobile UNIQUE(employee_id, mobile_number)
);

-- Create chat_sessions table for conversation tracking
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  campaign_id INTEGER,
  job_category_id INTEGER,
  session_token VARCHAR(255) UNIQUE,
  session_status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'archived'
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document', 'location'
  media_url TEXT,
  sender_type VARCHAR(50) NOT NULL, -- 'employee', 'admin', 'system'
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_employee_job_mobile_employee_id ON employee_job_mobile_mapping(employee_id);
CREATE INDEX idx_employee_job_mobile_mobile_number ON employee_job_mobile_mapping(mobile_number);
CREATE INDEX idx_employee_job_mobile_job_category ON employee_job_mobile_mapping(job_category_id);
CREATE INDEX idx_employee_job_mobile_chat_enabled ON employee_job_mobile_mapping(chat_enabled);
CREATE INDEX idx_employee_job_mobile_is_active ON employee_job_mobile_mapping(is_active);

CREATE INDEX idx_chat_sessions_employee_id ON chat_sessions(employee_id);
CREATE INDEX idx_chat_sessions_mobile_number ON chat_sessions(mobile_number);
CREATE INDEX idx_chat_sessions_session_status ON chat_sessions(session_status);
CREATE INDEX idx_chat_sessions_campaign_id ON chat_sessions(campaign_id);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_employee_id ON chat_messages(employee_id);
CREATE INDEX idx_chat_messages_sender_type ON chat_messages(sender_type);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable Row Level Security
ALTER TABLE employee_job_mobile_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_job_mobile_mapping
CREATE POLICY "Allow employees to view own mapping" ON employee_job_mobile_mapping
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Allow admins to manage all mappings" ON employee_job_mobile_mapping
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow service role full access" ON employee_job_mobile_mapping
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for chat_sessions
CREATE POLICY "Allow employees to view own sessions" ON chat_sessions
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Allow admins to manage all sessions" ON chat_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for chat_messages
CREATE POLICY "Allow employees to view own messages" ON chat_messages
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Allow admins to manage all messages" ON chat_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
