# Chat File Upload Feature Documentation

## Overview
The chat application now supports file uploads. Users can upload various file types including images, videos, audio files, documents, and more directly through chat messages.

## Supported File Types

### Images
- `.jpg`, `.jpeg` - JPEG images
- `.png` - PNG images
- `.gif` - GIF images
- `.webp` - WebP images

### Documents
- `.pdf` - PDF documents
- `.doc`, `.docx` - Microsoft Word documents
- `.xls`, `.xlsx` - Microsoft Excel spreadsheets
- `.txt` - Text files

### Media
- `.mp4` - MP4 videos
- `.mpeg` - MPEG videos
- `.mp3` - MP3 audio files
- `.wav` - WAV audio files

## File Size Limits
- Maximum file size: **50MB per file**

## API Endpoints

### 1. Upload File to Chat Session

**Endpoint:** `POST /api/chat/messages/upload`

**Authentication:** Required (JWT Token)

**Request Format:** `multipart/form-data`

**Request Body:**
```json
{
  "session_id": "uuid",
  "employee_id": "uuid",
  "message_text": "Optional message with file", // Optional
  "sender_type": "employee" // Optional, default: "employee"
}
```

**File Field:** `file` (single file)

**Example using cURL:**
```bash
curl -X POST http://localhost:3000/api/chat/messages/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "session_id=550e8400-e29b-41d4-a716-446655440000" \
  -F "employee_id=550e8400-e29b-41d4-a716-446655440001" \
  -F "message_text=Check out this document" \
  -F "file=@/path/to/file.pdf"
```

**Example using Fetch (JavaScript):**
```javascript
const formData = new FormData();
formData.append('session_id', sessionId);
formData.append('employee_id', employeeId);
formData.append('message_text', 'Here is my resume');
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/chat/messages/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
console.log('Upload successful:', data);
```

**Success Response (201):**
```json
{
  "message": "File uploaded successfully",
  "data": {
    "id": "message-uuid",
    "session_id": "session-uuid",
    "employee_id": "employee-uuid",
    "message_text": "Check out this document",
    "message_type": "file",
    "media_url": "https://supabase-url/storage/v1/object/public/chat-files/...",
    "sender_type": "employee",
    "created_at": "2024-06-20T10:30:00.000Z",
    "read_at": null,
    "file": {
      "fileName": "document.pdf",
      "fileSize": 1024000,
      "mimeType": "application/pdf",
      "storagePath": "session-uuid/file-uuid.pdf",
      "publicUrl": "https://supabase-url/storage/v1/object/public/chat-files/..."
    }
  }
}
```

**Error Responses:**
- `400` - No file provided, invalid file type, or file too large
- `500` - Server error during upload

### 2. Get File Download URL

**Endpoint:** `GET /api/chat/messages/:message_id/download`

**Authentication:** Required (JWT Token)

**Description:** Get a signed download URL for a file (expires in 1 hour)

**Example using cURL:**
```bash
curl -X GET http://localhost:3000/api/chat/messages/message-uuid/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response (200):**
```json
{
  "message_id": "message-uuid",
  "download_url": "https://supabase-url/storage/v1/object/signed/...",
  "expires_in_seconds": 3600
}
```

### 3. Delete File from Chat

**Endpoint:** `DELETE /api/chat/messages/:message_id/file`

**Authentication:** Required (JWT Token)

**Request Body:**
```json
{
  "employee_id": "uuid"
}
```

**Description:** Delete a file message from chat. Only the user who uploaded the file can delete it.

**Example using cURL:**
```bash
curl -X DELETE http://localhost:3000/api/chat/messages/message-uuid/file \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "employee-uuid"}'
```

**Success Response (200):**
```json
{
  "message": "File deleted successfully",
  "data": {
    "message_id": "message-uuid"
  }
}
```

**Error Responses:**
- `403` - Not authorized to delete (not the file owner)
- `404` - Message not found
- `500` - Server error

## Message Type Mapping

Based on the uploaded file type, the system automatically assigns a message type:

| File Category | Message Type |
|--------------|--------------|
| Images (jpg, png, gif, webp) | `image` |
| Videos (mp4, mpeg) | `video` |
| Audio (mp3, wav) | `audio` |
| All other files | `file` |

## File Storage

- Files are stored in Supabase Storage under the `chat-files` bucket
- Storage path format: `{session_id}/{unique_uuid}{file_extension}`
- File URLs are public by default but expire after 1 hour when requested for download

## Error Handling

### Common Errors:

**1. File Type Not Allowed**
```json
{
  "error": "File type not allowed: .exe"
}
```
**Solution:** Upload a supported file type

**2. File Size Exceeds Limit**
```json
{
  "error": "File size exceeds 50MB limit"
}
```
**Solution:** Upload a smaller file

**3. Session Not Found**
```json
{
  "error": "Session not found"
}
```
**Solution:** Ensure session_id is valid and exists

**4. Not Authorized**
```json
{
  "error": "Not authorized to delete this file"
}
```
**Solution:** Only the employee who uploaded the file can delete it

## Best Practices

1. **Always provide session_id and employee_id** - These are required for file uploads
2. **Check file size before uploading** - Validate client-side to improve UX
3. **Use appropriate message text** - Add a descriptive message with the file
4. **Handle download URLs promptly** - Signed URLs expire after 1 hour
5. **Cache public URLs** - Store the `publicUrl` from upload response for faster access
6. **Error handling** - Always handle upload errors gracefully in your frontend

## Database Schema

The `chat_messages` table supports file uploads with the following fields:

```sql
- id: UUID (primary key)
- session_id: UUID (foreign key)
- employee_id: UUID (foreign key)
- message_text: TEXT (can store file name)
- message_type: VARCHAR (text, image, video, audio, file)
- media_url: TEXT (public URL to file)
- file_metadata: JSONB (stores file details)
  {
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "storagePath": "session-id/uuid.pdf"
  }
- sender_type: VARCHAR (employee, admin, system)
- read_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Examples

### React Component Example

```javascript
import React, { useRef, useState } from 'react';

function ChatFileUpload({ sessionId, employeeId, token }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('employee_id', employeeId);
      formData.append('message_text', `Shared: ${file.name}`);
      formData.append('file', file);

      const response = await fetch('/api/chat/messages/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const data = await response.json();
      console.log('File uploaded:', data);
      // Handle successful upload
    } catch (err) {
      setError(err.message);
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="chat-file-upload">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default ChatFileUpload;
```

### Node.js/Express Example

```javascript
const formData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function uploadChatFile(sessionId, employeeId, filePath, token) {
  try {
    const form = new formData();
    form.append('session_id', sessionId);
    form.append('employee_id', employeeId);
    form.append('message_text', 'File shared');
    form.append('file', fs.createReadStream(filePath));

    const response = await axios.post(
      'http://localhost:3000/api/chat/messages/upload',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Upload successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { uploadChatFile };
```

## Troubleshooting

### Issue: "No file provided"
- Ensure you're using `multipart/form-data` format
- Check that the file field name is exactly `file`
- Verify that a file is selected in the input

### Issue: "File type not allowed"
- Check the supported file types list above
- Ensure the file extension matches the actual file type
- Avoid uploading executable files

### Issue: "Session not found"
- Verify the session_id is correct and active
- Check that the session exists in the database
- Ensure the employee_id matches the session

### Issue: Slow uploads
- Check your internet connection
- Consider breaking large files into smaller chunks
- Use a progress indicator for better UX
