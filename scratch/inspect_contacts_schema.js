import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectContactsSchema() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);

  if (error) {
    console.error("❌ Error fetching contact:", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log("📋 Contacts table sample record:");
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log("❓ Contacts table is empty.");
  }
}

inspectContactsSchema();
