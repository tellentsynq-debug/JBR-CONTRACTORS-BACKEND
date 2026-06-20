# Supabase Storage Setup for Chat File Uploads

## Prerequisites
- Supabase project created and active
- Supabase service role key (used in your `.env` file)
- Admin access to Supabase dashboard

## Setup Steps

### 1. Create Storage Bucket

#### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Storage** from the left sidebar
3. Click **Create a new bucket**
4. Enter bucket name: `chat-files`
5. Toggle **Public bucket** to ON (to allow public file access)
6. Click **Create bucket**

#### Option B: Using SQL (via Supabase Query Editor)

```sql
-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true);
```

### 2. Configure Bucket Policies

Add the following policies to allow authenticated users to upload, read, and delete files:

#### Option A: Using Supabase Dashboard

1. Go to **Storage** → **chat-files** bucket
2. Click **Policies** tab
3. Add the following policies:

**For SELECT (Read) - Public Access:**
```
Auth users can SELECT
Authenticated users can read all files
```

**For INSERT (Upload) - Authenticated Users:**
```
Auth users can INSERT
Authenticated users can upload files
```

**For DELETE - File Owner:**
```
Auth users can DELETE
Users can only delete their own files
```

#### Option B: Using SQL

```sql
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'chat-files' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.role() = 'authenticated'
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3. Environment Configuration

Update your `.env` file with Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Verify Storage Configuration

Test the connection using the following Node.js script:

```javascript
const supabaseModule = require('./src/config/database');
const supabaseAdmin = supabaseModule.admin;

async function testStorageConnection() {
  try {
    // List buckets
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return;
    }
    
    console.log('Available buckets:', buckets.map(b => b.name));
    
    // Check if chat-files bucket exists
    const chatFilesBucket = buckets.find(b => b.name === 'chat-files');
    if (chatFilesBucket) {
      console.log('✓ chat-files bucket found and configured');
      console.log('  - Public:', chatFilesBucket.public);
    } else {
      console.log('✗ chat-files bucket not found');
    }
    
  } catch (error) {
    console.error('Connection test failed:', error);
  }
}

testStorageConnection();
```

### 5. Database Schema Updates

Ensure your `chat_messages` table has the required columns:

```sql
-- Check existing columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'chat_messages';

-- If file_metadata column doesn't exist, add it:
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS file_metadata JSONB;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_media_url 
ON chat_messages(media_url)
WHERE media_url IS NOT NULL;
```

## File Organization in Storage

Files are organized by session ID in the bucket:

```
chat-files/
├── session-uuid-1/
│   ├── file-uuid-1.pdf
│   ├── file-uuid-2.png
│   └── file-uuid-3.mp4
├── session-uuid-2/
│   ├── file-uuid-4.docx
│   └── file-uuid-5.txt
└── session-uuid-3/
    └── file-uuid-6.mp3
```

## Security Considerations

### 1. File Size Limits
- Application limit: 50MB per file
- Adjust Supabase plan if needed for higher limits

### 2. Storage Quotas
Monitor storage usage in Supabase dashboard:
- Go to **Settings** → **Usage**
- Check current storage consumption
- Upgrade plan if approaching limits

### 3. Public URL Expiration
- Public URLs are accessible immediately
- Signed URLs expire after 1 hour (configurable)
- Implement refresh mechanism for long-lived access

### 4. Access Control
- Only authenticated users can upload files
- Users can only delete their own files
- Session-based organization ensures user isolation

## Common Issues & Solutions

### Issue 1: "Bucket not found"
**Cause:** Storage bucket `chat-files` doesn't exist
**Solution:** 
1. Go to Supabase dashboard
2. Create bucket named `chat-files`
3. Set as public bucket

### Issue 2: "Permission denied" on upload
**Cause:** Storage policies not configured correctly
**Solution:**
1. Check Storage → chat-files → Policies
2. Ensure INSERT policy exists for authenticated users
3. Verify user authentication before upload

### Issue 3: Files not accessible after upload
**Cause:** Bucket is not public or policy issue
**Solution:**
1. Go to bucket settings
2. Enable "Public bucket" toggle
3. Verify READ policy exists

### Issue 4: CORS errors when accessing files
**Cause:** CORS not configured in Supabase
**Solution:**
1. Go to **Settings** → **API**
2. Add your frontend URL to CORS allowed origins
3. Example: `https://yourdomain.com`

## Cleanup & Maintenance

### Delete old files manually:
```javascript
const supabaseModule = require('./src/config/database');
const supabaseAdmin = supabaseModule.admin;

async function deleteOldFiles(sessionId) {
  try {
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('chat-files')
      .list(`${sessionId}`);
    
    if (listError) throw listError;
    
    // Delete all files in session
    const filePaths = files.map(f => `${sessionId}/${f.name}`);
    const { error: deleteError } = await supabaseAdmin.storage
      .from('chat-files')
      .remove(filePaths);
    
    if (deleteError) throw deleteError;
    console.log(`Deleted ${filePaths.length} files from session ${sessionId}`);
  } catch (error) {
    console.error('Error deleting files:', error);
  }
}
```

### Archive session files:
When archiving a chat session, optionally archive its files:
```javascript
async function archiveSessionFiles(sessionId) {
  try {
    // Get all files
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('chat-files')
      .list(`${sessionId}`);
    
    if (listError) throw listError;
    
    // Move files to archive folder (copy and delete)
    for (const file of files) {
      const sourcePath = `${sessionId}/${file.name}`;
      const destPath = `archived/${sessionId}/${file.name}`;
      
      // Copy file
      const { data: file_data } = await supabaseAdmin.storage
        .from('chat-files')
        .download(sourcePath);
      
      await supabaseAdmin.storage
        .from('chat-files')
        .upload(destPath, file_data);
      
      // Delete original
      await supabaseAdmin.storage
        .from('chat-files')
        .remove([sourcePath]);
    }
    
    console.log(`Archived files for session ${sessionId}`);
  } catch (error) {
    console.error('Error archiving files:', error);
  }
}
```

## Performance Optimization

### 1. Image Optimization
Consider adding image transformation on Supabase:
```javascript
// Get optimized image thumbnail
const imageUrl = supabaseAdmin.storage
  .from('chat-files')
  .getPublicUrl(path, {
    transform: {
      width: 200,
      height: 200,
      resize: 'cover'
    }
  }).data.publicUrl;
```

### 2. CDN Usage
- Supabase uses Cloudflare CDN by default
- Files are cached automatically
- No additional configuration needed

### 3. Batch Operations
- Use batch API for multiple file operations
- Reduces number of API calls
- Improves performance

## Monitoring & Analytics

### Monitor storage usage:
```sql
-- Get total storage used by session
SELECT 
  SPLIT_PART(name, '/', 1) as session_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_size_bytes
FROM storage.objects
WHERE bucket_id = 'chat-files'
GROUP BY session_id
ORDER BY total_size_bytes DESC;
```

### Get file upload stats:
```sql
-- Files uploaded per day
SELECT 
  DATE(created_at) as upload_date,
  COUNT(*) as file_count,
  AVG(metadata->>'size') as avg_file_size
FROM storage.objects
WHERE bucket_id = 'chat-files'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY upload_date DESC;
```

## Backup & Recovery

### Export chat files:
```bash
# Download all files from bucket
aws s3 sync \
  s3://your-project.supabase.co/storage/v1/object/public/chat-files \
  ./backup/chat-files --recursive
```

### Restore chat files:
```bash
# Upload files back
aws s3 sync \
  ./backup/chat-files \
  s3://your-project.supabase.co/storage/v1/object/public/chat-files --recursive
```

## References
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Storage API](https://supabase.com/docs/reference/javascript/storage-createbucket)
- [Supabase RLS & Policies](https://supabase.com/docs/guides/auth/row-level-security)
