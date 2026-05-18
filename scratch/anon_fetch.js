import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const listId = '004d7696-d396-4916-86fa-ff52ed5c7a38';
    
    // Simulate frontend query
    const { data: contacts, error, count } = await supabase
      .from('contacts')
      .select(`
        *,
        template:templates(name),
        attachment:attachments(filename, storage_path)
      `, { count: 'exact' })
      .eq('list_id', listId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('--- Client Anon Query Results ---');
    console.log('Returned Contacts Length:', contacts.length);
    console.log('Returned exact count:', count);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
