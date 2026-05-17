import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres:nVfOd8PrZrV3UbzD@db.hdfbgixlgofjafkgfkin.supabase.co:5432/postgres';

async function testConn() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Check if contacts table has sender_id column
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'contacts';
    `);
    console.log('Columns in contacts table:');
    console.table(res.rows);
    
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  } finally {
    await client.end();
  }
}

testConn();
