const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;
const { v4: uuidv4 } = require('uuid');
const util = require('util');

// Try uploading to a list of candidate buckets. Some Supabase projects may name buckets differently
// or disallow server-side bucket creation. We'll attempt each candidate and only fail if
// none accept the upload.
function isBucketNotFoundError(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('bucket') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('not found')) || (err.status === 404);
}

/**
 * Helper: upload base64 data URI or raw base64 to Supabase storage
 */
async function uploadBase64ToStorage(base64Str, userId, preferredBucket = process.env.SUPABASE_DOCUMENT_BUCKET || 'user-documents') {
  // strip data:*/*;base64, prefix if present
  const matches = base64Str.match(/^data:(.+);base64,(.+)$/);
  let contentType = 'application/octet-stream';
  let b64 = base64Str;
  if (matches) {
    contentType = matches[1];
    b64 = matches[2];
  }

  const buffer = Buffer.from(b64, 'base64');
  const ext = contentType.split('/')[1] || 'bin';
  const fileName = `${userId || 'anonymous'}/${uuidv4()}.${ext}`;

  // Build candidate bucket list and prefer any existing buckets that look like document buckets
  const staticCandidates = [preferredBucket, process.env.SUPABASE_DOCUMENT_BUCKET, 'user-documents', 'documents', 'bank-documents', 'chat-files']
    .filter(Boolean);

  let discovered = [];
  try {
    const { data: bucketList, error: listErr } = await supabaseAdmin.storage.listBuckets();
    if (!listErr && Array.isArray(bucketList?.data || bucketList)) {
      const bucketsArray = Array.isArray(bucketList.data) ? bucketList.data : bucketList;
      const lower = (s) => (s || '').toLowerCase();
      // find buckets with names containing document-like keywords
      discovered = bucketsArray
        .map((b) => b.name)
        .filter((name) => {
          const n = lower(name);
          return ['doc', 'document', 'upload', 'bank', 'user', 'chat', 'file', 'resume'].some((k) => n.includes(k));
        });
    }
  } catch (e) {
    console.warn('Failed to list buckets for discovery:', e && e.message ? e.message : e);
  }

  const candidates = [...new Set([].concat(discovered, staticCandidates))];
  const uniqueCandidates = candidates.filter(Boolean);

  let lastErr = null;
  for (const bucketName of uniqueCandidates) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(fileName, buffer, { contentType, upsert: false });

      if (error) {
        if (isBucketNotFoundError(error)) {
          lastErr = error;
          console.warn(`Bucket not found, trying next candidate: ${bucketName}`);
          continue; // try next bucket
        }
        throw error;
      }

      const { data: urlData, error: urlErr } = await supabaseAdmin.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      if (urlErr) {
        // If public URL retrieval fails, still return storage path and bucket
        console.warn('Failed to get public URL:', urlErr);
        return { storagePath: fileName, publicUrl: null, bucketName };
      }

      return { storagePath: fileName, publicUrl: urlData.publicUrl, bucketName };
    } catch (err) {
      if (isBucketNotFoundError(err)) {
        lastErr = err;
        console.warn(`Bucket not found when uploading to ${bucketName}:`, err.message || err);
        continue;
      }
      throw err;
    }
  }

  // If we exhausted candidates, surface the last bucket-related error or a generic one
  if (lastErr) throw lastErr;
  throw new Error('Unable to upload document to any configured Supabase storage bucket');
}

/**
 * POST /documents/bank-account
 */
exports.uploadBankAccount = async (req, res) => {
  try {
    const userId = req.userId || null;
    const { accountNumber, supportingDocument } = req.body || {};

    if (!accountNumber || String(accountNumber).trim() === '') {
      return res.status(400).json({ error: 'accountNumber is required' });
    }

    let documentUrl = null;
    let storagePath = null;

    if (supportingDocument) {
      if (String(supportingDocument).startsWith('http')) {
        documentUrl = supportingDocument;
      } else {
        // assume base64
        const uploaded = await uploadBase64ToStorage(supportingDocument, userId);
        documentUrl = uploaded.publicUrl;
        storagePath = uploaded.storagePath;
      }
    }

    const insertObj = {
      user_id: userId,
      doc_type: 'bank_account',
      account_number: String(accountNumber),
      document_url: documentUrl,
      storage_path: storagePath
    };

    const { data, error } = await supabaseAdmin.from('user_documents').insert([insertObj]).select();
    if (error) {
      const errInfo = {
        message: error.message || null,
        status: error.status || null,
        code: error.code || null,
        details: error.details || null,
        hint: error.hint || null,
        full: util.inspect(error, { depth: null })
      };
      console.error('Error inserting bank account document:', errInfo);
      return res.status(500).json({ error: 'Failed to save bank account', details: errInfo });
    }

    res.status(201).json({ message: 'Bank account uploaded', data: data[0] });
  } catch (err) {
    console.error('Error in uploadBankAccount:', err);
    res.status(500).json({ error: 'Failed to upload bank account', details: err.message || String(err) });
  }
};

/**
 * POST /documents/sin
 */
exports.uploadSin = async (req, res) => {
  try {
    const userId = req.userId || null;
    const { sinNumber, supportingDocument } = req.body || {};

    if (!sinNumber || String(sinNumber).trim() === '') {
      return res.status(400).json({ error: 'sinNumber is required' });
    }

    let documentUrl = null;
    let storagePath = null;

    if (supportingDocument) {
      if (String(supportingDocument).startsWith('http')) {
        documentUrl = supportingDocument;
      } else {
        const uploaded = await uploadBase64ToStorage(supportingDocument, userId);
        documentUrl = uploaded.publicUrl;
        storagePath = uploaded.storagePath;
      }
    }

    const insertObj = {
      user_id: userId,
      doc_type: 'sin',
      sin_number: String(sinNumber),
      document_url: documentUrl,
      storage_path: storagePath
    };

    const { data, error } = await supabaseAdmin.from('user_documents').insert([insertObj]).select();
    if (error) {
      const errInfo = {
        message: error.message || null,
        status: error.status || null,
        code: error.code || null,
        details: error.details || null,
        hint: error.hint || null,
        full: util.inspect(error, { depth: null })
      };
      console.error('Error inserting sin document:', errInfo);
      return res.status(500).json({ error: 'Failed to save sin', details: errInfo });
    }

    res.status(201).json({ message: 'SIN uploaded', data: data[0] });
  } catch (err) {
    console.error('Error in uploadSin:', err);
    res.status(500).json({ error: 'Failed to upload sin', details: err.message || String(err) });
  }
};
