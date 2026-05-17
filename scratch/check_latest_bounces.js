import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function auditBounces() {
  console.log("🔍 Fetching the last 10 bounced contacts...");
  
  const { data: bouncedContacts, error } = await supabase
    .from('contacts')
    .select('id, email, status, data, sender_id, scheduled_send_at')
    .eq('status', 'bounced')
    .order('scheduled_send_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Error fetching bounced contacts:", error.message);
    return;
  }

  if (!bouncedContacts || bouncedContacts.length === 0) {
    console.log("✅ No bounced contacts found!");
    return;
  }

  console.log(`\nFound ${bouncedContacts.length} bounced contacts. Auditing:\n`);
  
  for (const contact of bouncedContacts) {
    const senderId = contact.sender_id || contact.data?.sender_id;
    let senderEmail = "Unknown Sender";
    let senderProvider = "Unknown";
    
    if (senderId) {
      const { data: sender } = await supabase
        .from('senders')
        .select('email, provider')
        .eq('id', senderId)
        .single();
      
      if (sender) {
        senderEmail = sender.email;
        senderProvider = sender.provider;
      }
    }
    
    const errorMsg = contact.data?.error || contact.data?.last_error || contact.last_error || "No error message saved";
    
    console.log(`📧 Contact Email: ${contact.email}`);
    console.log(`   Scheduled Send: ${contact.scheduled_send_at}`);
    console.log(`   Sender Used   : ${senderEmail} (${senderProvider})`);
    console.log(`   Error Message : ${errorMsg}`);
    console.log("--------------------------------------------------");
  }
}

auditBounces();
