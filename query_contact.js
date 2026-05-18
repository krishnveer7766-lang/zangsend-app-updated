import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, status, sent_at, opened_at, clicked_at, data')
    .eq('email', 'krishnveer7766@gmail.com')
    .limit(10);

  if (error) {
    console.error('Error fetching contacts:', error);
    return;
  }

  console.log('Query result:');
  console.log(JSON.stringify(data, null, 2));
}

run();
