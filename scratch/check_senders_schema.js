import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log("📋 Printing the first sender record to inspect its columns...");
  const { data: senders, error } = await supabase
    .from('senders')
    .select('*')
    .limit(1);

  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }

  if (!senders || senders.length === 0) {
    console.log("❌ No senders found in database!");
    return;
  }

  console.log("✅ First sender record keys and values:");
  console.log(JSON.stringify(senders[0], null, 2));
}

checkSchema();
