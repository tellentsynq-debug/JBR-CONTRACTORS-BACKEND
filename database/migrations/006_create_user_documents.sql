-- User documents table
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  doc_type TEXT NOT NULL,
  account_number TEXT,
  sin_number TEXT,
  document_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_doc_type ON user_documents (doc_type);
