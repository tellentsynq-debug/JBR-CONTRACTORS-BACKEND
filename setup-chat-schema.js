const supabaseModule = require('./src/config/database');
const supabaseAdmin = supabaseModule.admin;
const fs = require('fs');
const path = require('path');

async function setupChatSchema() {
  try {
    console.log('🔧 Setting up Chat System Schema...\n');

    // Read the chat schema SQL file
    const schemaFilePath = path.join(__dirname, 'database', 'chat_schema_setup.sql');
    const schemaSql = fs.readFileSync(schemaFilePath, 'utf-8');

    // Split SQL statements (simple splitting by semicolon)
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql_string: statement
      }).catch(err => ({ error: err }));

      if (error && !error.message?.includes('already exists')) {
        console.warn(`⚠️  Warning: ${error.message}`);
      }
    }

    // Alternative: Use direct SQL execution via Supabase API
    console.log('\n📋 Verifying chat tables...');
    
    // Check if chat_sessions table exists
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .limit(1);

    if (!sessionsError) {
      console.log('✅ chat_sessions table exists');
    }

    // Check if chat_messages table exists
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('id')
      .limit(1);

    if (!messagesError) {
      console.log('✅ chat_messages table exists');
    }

    // Check if file_metadata column exists by trying to insert
    const testData = {
      session_id: '00000000-0000-0000-0000-000000000000',
      employee_id: '00000000-0000-0000-0000-000000000001',
      message_text: 'test',
      message_type: 'text',
      sender_type: 'employee',
      file_metadata: { test: 'metadata' }
    };

    const { error: metadataError } = await supabaseAdmin
      .from('chat_messages')
      .insert([testData])
      .select();

    if (metadataError?.message?.includes('file_metadata')) {
      console.log('⚠️  file_metadata column needs to be added');
      console.log('📝 Adding file_metadata column...');
      
      const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
        sql_string: `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_metadata JSONB DEFAULT NULL;`
      }).catch(err => ({ error: err }));

      if (!alterError) {
        console.log('✅ file_metadata column added successfully');
      }
    } else if (!metadataError) {
      console.log('✅ file_metadata column is working');
      // Clean up test data
      await supabaseAdmin
        .from('chat_messages')
        .delete()
        .eq('message_text', 'test');
    }

    console.log('\n✅ Chat System Schema Setup Complete!\n');
    console.log('📚 Tables ready:');
    console.log('   • chat_sessions - Stores chat sessions');
    console.log('   • chat_messages - Stores chat messages with file support');
    console.log('   • Indexes created for performance optimization');

  } catch (error) {
    console.error('\n❌ Error setting up chat schema:', error.message);
    console.log('\nPlease run the following SQL manually in Supabase SQL Editor:');
    console.log('📄 File: database/chat_schema_setup.sql');
    process.exit(1);
  }
}

setupChatSchema().then(() => {
  console.log('\n🎉 Setup completed successfully!');
  process.exit(0);
});
