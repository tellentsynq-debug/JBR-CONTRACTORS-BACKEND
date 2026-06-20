# Chat System Database Setup

## Problem
The `file_metadata` column was missing from the `chat_messages` table, causing upload errors.

## Solution

### Option 1: Run SQL Manually (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a **New Query**
3. Copy and paste the contents of [`database/chat_schema_setup.sql`](./database/chat_schema_setup.sql)
4. Click **Run** button
5. Wait for all statements to complete

### Option 2: Run Just the Migration

If your tables already exist and you only need to add the `file_metadata` column:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a **New Query**
3. Run this SQL:

```sql
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS file_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN chat_messages.file_metadata IS 'Stores file metadata like fileName, fileSize, mimeType, storagePath when a file is uploaded';
```

### Option 3: Verify Existing Tables

Run this to check if the schema is already set up:

```sql
-- Check chat_sessions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_sessions' 
ORDER BY ordinal_position;

-- Check chat_messages table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
ORDER BY ordinal_position;
```

## What Gets Created

### chat_sessions Table
- `id` - UUID primary key
- `employee_id` - References employees table
- `mobile_number` - Customer's mobile number
- `campaign_id` - Associated campaign
- `job_category_id` - Job category
- `session_token` - Unique session token
- `session_status` - active/archived/closed
- `message_count` - Total messages in session
- `last_message_at` - Timestamp of last message
- `started_at` - Session start time
- `ended_at` - Session end time (if closed)

### chat_messages Table
- `id` - UUID primary key
- `session_id` - References chat_sessions
- `employee_id` - References employees
- `message_text` - Message content
- `message_type` - text/image/video/audio/file
- `media_url` - URL to file in storage
- **`file_metadata`** - JSON object with file info:
  ```json
  {
    "fileName": "image.jpg",
    "fileSize": 245678,
    "mimeType": "image/jpeg",
    "storagePath": "session-id/uuid.jpg"
  }
  ```
- `sender_type` - employee/admin/system
- `read_at` - When message was read
- `created_at` - Message creation time

## Indexes Created
- `idx_chat_sessions_employee_id` - For fast employee lookups
- `idx_chat_sessions_status` - For filtering by status
- `idx_chat_sessions_created_at` - For ordering by date
- `idx_chat_messages_session_id` - For fast message queries
- `idx_chat_messages_employee_id` - For employee lookups
- `idx_chat_messages_read_at` - For unread message filtering
- `idx_chat_messages_created_at` - For message ordering

## Verification After Setup

After running the SQL, verify everything works:

```bash
# Test file upload
curl -X POST http://localhost:3000/api/chat/messages/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg" \
  -F "session_id=YOUR_SESSION_ID" \
  -F "employee_id=YOUR_EMPLOYEE_ID"
```

Expected response:
```json
{
  "message": "File uploaded successfully",
  "data": {
    "message_type": "image",
    "file_metadata": {
      "fileName": "test.jpg",
      "fileSize": 12345,
      "mimeType": "image/jpeg",
      "storagePath": "session-id/uuid.jpg"
    }
  }
}
```

## Troubleshooting

### "file_metadata column not found"
- Run the migration SQL from Option 2 above
- Make sure to use `JSONB` data type

### "chat_messages table not found"
- Run the complete setup from `database/chat_schema_setup.sql`

### "permission denied" error
- Make sure you're using Supabase project credentials with admin access
- The `.env` file should have correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## Files Modified
- ✅ `src/services/employeeChatService.js` - Fixed JSON handling
- ✅ `database/chat_schema_setup.sql` - Complete schema definition
- ✅ `database/migrations/002_add_file_metadata_to_chat_messages.sql` - Migration file
