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
    // Run an arbitrary SQL query via a PostgREST RPC function if available, 
    // or let's select from information_schema via standard select if exposed,
    // or let's use the supabase sql editor if we can.
    // Wait, PostgREST doesn't expose information_schema by default.
    // Let's see if there is an rpc function we can query.
    console.log('Querying existing tables directly...');
    
    // We can also query all profiles to see if the display names or sender emails are there
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('*');
      
    if (pError) console.error('Profiles error:', pError.message);
    else console.log('Profiles data (sample/length):', profiles?.length, profiles?.[0]);

    // Let's also check if there are other lists
    const { data: lists, error: lError } = await supabase
      .from('lists')
      .select('*');
    if (lError) console.error('Lists error:', lError.message);
    else console.log('Lists data (length):', lists?.length, lists);
  } catch (err) {
    console.error('Exception:', err);
  }
}

check();
