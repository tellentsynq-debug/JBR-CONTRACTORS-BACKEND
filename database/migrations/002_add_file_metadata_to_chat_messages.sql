-- Migration: Add file_metadata column to chat_messages table
-- This migration adds support for storing file metadata when files are uploaded to chat sessions

-- Add file_metadata column to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS file_metadata JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN chat_messages.file_metadata IS 'Stores file metadata like fileName, fileSize, mimeType, storagePath when a file is uploaded';
