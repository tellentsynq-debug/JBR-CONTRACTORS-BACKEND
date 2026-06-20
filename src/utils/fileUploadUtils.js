const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;

// Configure multer for memory storage (we'll upload to Supabase)
const storage = multer.memoryStorage();

// File filter to allow specific file types
const fileFilter = (req, file, cb) => {
  // Allowed file types for chat
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4',
    'video/mpeg',
    'audio/mpeg',
    'audio/wav',
    'text/plain'
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.mp4', '.mpeg', '.mp3', '.wav', '.txt'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

// Multer middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * Upload file to Supabase storage
 */
async function uploadFileToSupabase(file, sessionId) {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const uniqueFileName = `${sessionId}/${uuidv4()}${fileExtension}`;
    
    // Upload to Supabase storage
    const { data, error } = await supabaseAdmin.storage
      .from('jbr')
      .upload(uniqueFileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('jbr')
      .getPublicUrl(uniqueFileName);

    return {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath: uniqueFileName,
      publicUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error('Error uploading file to Supabase:', error);
    throw error;
  }
}

/**
 * Delete file from Supabase storage
 */
async function deleteFileFromSupabase(storagePath) {
  try {
    const { error } = await supabaseAdmin.storage
      .from('jbr')
      .remove([storagePath]);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error deleting file from Supabase:', error);
    throw error;
  }
}

/**
 * Get file download URL
 */
async function getFileDownloadUrl(storagePath, expirationSeconds = 3600) {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('jbr')
      .createSignedUrl(storagePath, expirationSeconds);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}

/**
 * Validate file for upload
 */
function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds 50MB limit` };
  }

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.mp4', '.mpeg', '.mp3', '.wav', '.txt'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: `File type not allowed: ${fileExtension}` };
  }

  return { valid: true };
}

module.exports = {
  upload,
  uploadFileToSupabase,
  deleteFileFromSupabase,
  getFileDownloadUrl,
  validateFile
};
