import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSenders() {
  console.log("👥 Fetching all registered senders...");
  const { data: senders, error: senderError } = await supabase
    .from('senders')
    .select('*');

  if (senderError) {
    console.error("❌ Error fetching senders:", senderError.message);
    return;
  }

  console.log(`Found ${senders.length} registered senders:`);
  senders.forEach(s => {
    console.log(`- ID: ${s.id} | Email: ${s.email} | AuthType: ${s.auth_type}`);
  });

  console.log("\n💥 Checking bounced contacts' sender_id values...");
  const { data: bounces, error: bounceError } = await supabase
    .from('contacts')
    .select('id, email, sender_id, data')
    .eq('status', 'bounced')
    .limit(10);

  if (bounceError) {
    console.error("❌ Error fetching bounced contacts:", bounceError.message);
    return;
  }

  bounces.forEach(b => {
    const sId = b.sender_id || b.data?.sender_id;
    console.log(`- Contact: ${b.email} | sender_id on contact: ${sId}`);
  });
}

debugSenders();
