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
    // We can query information_schema or just execute a quick check on known/suspected tables
    const tables = [
      'profiles',
      'lists',
      'templates',
      'campaigns',
      'contacts',
      'apify_keys',
      'telegram_config',
      'senders',
      'attachments'
    ];

    console.log('--- Public Schema Table Counts ---');
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`Table "${table}": Error - ${error.message}`);
      } else {
        console.log(`Table "${table}": ${count} rows`);
      }
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

check();
