const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();
//sometag
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws
  }
});

module.exports = supabase;
