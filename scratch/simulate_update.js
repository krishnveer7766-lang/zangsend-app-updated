import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
  // First, find a pending contact
  // We'll use the service role key first to find one, then try updating it using the anon client.
  const serviceSupabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: contacts, error: findError } = await serviceSupabase
    .from('contacts')
    .select('*')
    .eq('status', 'pending')
    .limit(1);

  if (findError || !contacts || contacts.length === 0) {
    console.log("No pending contacts found to test with.", findError);
    return;
  }

  const contact = contacts[0];
  console.log("Testing with contact ID:", contact.id);
  console.log("Contact current user_id:", contact.user_id);
  console.log("Contact email:", contact.email);

  // Now, try updating it with the service role client (which bypasses RLS) to see if the query itself is valid
  console.log("\nTrying update with SERVICE ROLE CLIENT (RLS Bypassed):");
  const updateResService = await serviceSupabase
    .from('contacts')
    .update({
      status: 'scheduled',
      scheduled_send_at: new Date().toISOString(),
      sender_id: '00000000-0000-0000-0000-000000000000' // dummy sender ID
    })
    .eq('id', contact.id)
    .select();

  console.log("Service role update response:");
  console.log("Status:", updateResService.status, updateResService.statusText);
  console.log("Error:", updateResService.error);
  console.log("Returned data length:", updateResService.data?.length);
}

simulate();
