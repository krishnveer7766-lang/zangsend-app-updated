import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  const { data, error } = await supabase
    .from('senders')
    .select('*')
    .limit(1);

  if (error) {
    console.error("❌ Error fetching sender record:", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log("📋 Senders table columns and a sample record:");
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log("❓ Senders table is empty.");
  }
}

inspectSchema();
