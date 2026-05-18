import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { count: profilesCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: sendersCount } = await supabase
      .from('senders')
      .select('*', { count: 'exact', head: true });

    const { count: contactsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    console.log('--- Database Table Counts ---');
    console.log('Profiles Count:', profilesCount);
    console.log('Senders Count:', sendersCount);
    console.log('Contacts Count:', contactsCount);
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
