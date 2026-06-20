-- Chat System Tables Setup
-- Run this in Supabase SQL Editor to create all chat-related tables

-- Drop existing tables if needed
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;

-- Create chat_sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  campaign_id INTEGER,
  job_category_id INTEGER,
  job_industry_id INTEGER,
  session_token VARCHAR(255) UNIQUE,
  session_status VARCHAR(50) DEFAULT 'active', -- active, archived, closed
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_employee_id FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  message_text TEXT,
  message_type VARCHAR(50) DEFAULT 'text', -- text, image, video, audio, file
  media_url TEXT,
  sender_type VARCHAR(50) DEFAULT 'employee', -- employee, admin, system
  read_at TIMESTAMP WITH TIME ZONE,
  file_metadata JSONB DEFAULT NULL, -- Stores: {fileName, fileSize, mimeType, storagePath}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_employee_id FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_chat_sessions_employee_id ON chat_sessions(employee_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(session_status);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_employee_id ON chat_messages(employee_id);
CREATE INDEX idx_chat_messages_read_at ON chat_messages(read_at);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Add comments
COMMENT ON TABLE chat_sessions IS 'Stores chat session information between employees and customers';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat sessions';
COMMENT ON COLUMN chat_sessions.session_token IS 'Unique token for session validation';
COMMENT ON COLUMN chat_messages.file_metadata IS 'JSON metadata for file uploads: {fileName, fileSize, mimeType, storagePath}';

-- Enable Row Level Security (RLS) if needed
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to view their own chat sessions
CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid()::text = employee_id::text);

-- Create RLS policy to allow users to view messages from their sessions
CREATE POLICY "Users can view messages from their sessions"
  ON chat_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM chat_sessions 
      WHERE auth.uid()::text = employee_id::text
    )
  );
