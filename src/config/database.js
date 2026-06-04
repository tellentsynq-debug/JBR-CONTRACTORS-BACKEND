const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL is not set');
}
if (!supabaseKey) {
  console.error('❌ VITE_SUPABASE_PUBLISHABLE_KEY is not set');
}
if (!supabaseServiceKey) {
  console.warn('⚠️  SUPABASE_SERVICE_KEY is not set - using publishable key as fallback');
}

console.log('✓ Initializing Supabase clients...');
console.log(`  URL: ${supabaseUrl}`);

// Public client (for client-side operations with RLS)
const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws
  }
});

// Admin client (for server-side operations, bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseKey, {
  realtime: {
    transport: ws
  }
});

console.log('✓ Supabase clients initialized');

module.exports = supabase;
module.exports.admin = supabaseAdmin;
