const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;
const { v4: uuidv4 } = require('uuid');
const util = require('util');

/**
 * Helper: upload base64 data URI or raw base64 to Supabase storage
 */
async function uploadBase64ToStorage(base64Str, userId) {
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

  const { data, error } = await supabaseAdmin.storage
    .from('user-documents')
    .upload(fileName, buffer, { contentType, upsert: false });

  if (error) {
    throw error;
  }

  const { data: urlData, error: urlErr } = supabaseAdmin.storage
    .from('user-documents')
    .getPublicUrl(fileName);

  if (urlErr) throw urlErr;

  return { storagePath: fileName, publicUrl: urlData.publicUrl };
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
      console.error('Error inserting bank account document:', util.inspect(error, { depth: null }));
      return res.status(500).json({ error: 'Failed to save bank account', details: util.inspect(error, { depth: null }) });
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
      console.error('Error inserting sin document:', util.inspect(error, { depth: null }));
      return res.status(500).json({ error: 'Failed to save sin', details: util.inspect(error, { depth: null }) });
    }

    res.status(201).json({ message: 'SIN uploaded', data: data[0] });
  } catch (err) {
    console.error('Error in uploadSin:', err);
    res.status(500).json({ error: 'Failed to upload sin', details: err.message || String(err) });
  }
};
