const supabaseModule = require('./src/config/database');
const supabaseAdmin = supabaseModule.admin;

async function setupChatBucket() {
  try {
    console.log('Setting up chat-files bucket...');

    // Try to list buckets first to check if it exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.log('Could not list buckets:', listError.message);
    } else {
      const chatBucketExists = buckets?.some(b => b.name === 'chat-files');
      if (chatBucketExists) {
        console.log('✓ Bucket chat-files already exists');
        return;
      }
    }

    // Create the bucket with minimal options
    console.log('Creating chat-files bucket...');
    const { data: bucketData, error: bucketError } = await supabaseAdmin.storage.createBucket('chat-files', {
      public: true
    });

    if (bucketError) {
      if (bucketError.message?.includes('already exists')) {
        console.log('✓ Bucket chat-files already exists');
      } else {
        throw bucketError;
      }
    } else {
      console.log('✓ Created bucket: chat-files');
    }

    console.log('✓ Chat bucket is ready to use');
    console.log('\nChat files will be uploaded to: storage/chat-files/');
    console.log('Max file size: 50MB per file');

  } catch (error) {
    console.error('Error setting up chat bucket:', error.message);
    process.exit(1);
  }
}

setupChatBucket().then(() => {
  console.log('\n✓ Setup completed successfully!');
  process.exit(0);
});
