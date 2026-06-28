const sup = require('../src/config/database');

(async () => {
  try {
    console.log('Listing buckets...');
    const buckets = await sup.admin.storage.listBuckets();
    console.log(JSON.stringify(buckets, null, 2));
  } catch (err) {
    console.error('Error listing buckets:', err);
  }

  try {
    console.log('\nChecking user_documents select (limit 1)...');
    const res = await sup.admin.from('user_documents').select('*').limit(1);
    console.log('user_documents select result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error selecting from user_documents:', err);
  }

  try {
    console.log('\nSelecting from pg_catalog.tables to check table visibility...');
    const tables = await sup.admin.from('pg_catalog.pg_tables').select('schemaname,tablename').limit(20);
    console.log('pg_tables result:', JSON.stringify(tables, null, 2));
  } catch (err) {
    console.error('Error querying pg_tables:', err);
  }

  process.exit(0);
})();
