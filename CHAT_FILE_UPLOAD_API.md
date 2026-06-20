# Chat File Upload Guide

## Setup

The chat file upload bucket has been created and configured in Supabase.

**Bucket Name:** `chat-files`  
**Type:** Public (files are publicly accessible)  
**Max File Size:** 50MB per file

### Already Configured Files:
- ✅ Supabase bucket created
- ✅ Routes set up
- ✅ Upload endpoint ready
- ✅ File validation enabled

## Supported File Types

- **Images:** .jpg, .jpeg, .png, .gif, .webp
- **Documents:** .pdf, .doc, .docx, .xls, .xlsx, .txt
- **Media:** .mp4, .mpeg, .mp3, .wav

## API Endpoints

### Upload File
```
POST /api/chat/messages/upload
Content-Type: multipart/form-data

Body:
- file: (binary file) - Required
- session_id: (UUID) - Required
- employee_id: (UUID) - Required
- message_text: (string) - Optional
- sender_type: (string) - Optional, default: 'employee'

Headers:
- Authorization: Bearer {token}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/chat/messages/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@image.jpg" \
  -F "session_id=f69a5187-10a3-4cc4-8cdb-8bc..." \
  -F "employee_id=a2cef5db-677b-448a-b9b6-ca00490d2370"
```

**Response Example:**
```json
{
  "message": "File uploaded successfully",
  "data": {
    "id": "msg-123",
    "session_id": "f69a5187-10a3-4cc4-8cdb-8bc...",
    "employee_id": "a2cef5db-677b-448a-b9b6-ca00490d2370",
    "message_text": "image.jpg",
    "message_type": "image",
    "sender_type": "employee",
    "media_url": "https://vwclmbyjkemkiumqzbxm.supabase.co/storage/v1/object/public/chat-files/...",
    "created_at": "2026-06-20T10:30:00Z",
    "file": {
      "fileName": "image.jpg",
      "fileSize": 245678,
      "mimeType": "image/jpeg",
      "storagePath": "f69a5187-10a3-4cc4-8cdb-8bc.../uuid-value.jpg",
      "publicUrl": "https://vwclmbyjkemkiumqzbxm.supabase.co/storage/v1/object/public/chat-files/..."
    }
  }
}
```

### Get File Download URL
```
GET /api/chat/messages/:message_id/download

Headers:
- Authorization: Bearer {token}
```

### Delete File
```
DELETE /api/chat/messages/:message_id/file

Body:
{
  "employee_id": "a2cef5db-677b-448a-b9b6-ca00490d2370"
}

Headers:
- Authorization: Bearer {token}
```

## File Storage Structure

Files are stored in Supabase with the following structure:
```
chat-files/
├── {session_id}/
│   ├── {uuid}.jpg
│   ├── {uuid}.pdf
│   └── {uuid}.mp4
└── {session_id}/
    └── {uuid}.png
```

## Features

✅ **Automatic File Type Detection**
- Images → message type: "image"
- Videos → message type: "video"
- Audio → message type: "audio"
- Other → message type: "file"

✅ **Public URLs**
- All uploaded files are publicly accessible
- URLs can be shared without authentication

✅ **File Metadata Storage**
- Original filename
- File size
- MIME type
- Storage path
- Public URL

✅ **Automatic Message Creation**
- Uploading creates a message in the chat
- Message can include optional text with the file

## Testing

Use the Postman collection or curl commands above to test file uploads. Make sure to:

1. Have an active chat session created
2. Use valid employee_id
3. Include authentication token
4. Send file as multipart form data
