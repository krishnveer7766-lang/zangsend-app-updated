import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetBounced() {
  console.log("🔄 Resetting bounced contacts back to scheduled status...");
  
  // Set the scheduled time to 1 minute from now
  const oneMinuteFromNow = new Date(Date.now() + 60000).toISOString();

  const { data, error } = await supabase
    .from('contacts')
    .update({ 
      status: 'scheduled',
      scheduled_send_at: oneMinuteFromNow,
      last_error: null
    })
    .eq('status', 'bounced');

  if (error) {
    console.error("❌ Failed to reset contacts:", error.message);
  } else {
    console.log("✅ Success! All bounced contacts have been reset to 'scheduled' status.");
    console.log("They are scheduled to send in 1 minute. Keep your Vercel tab open to watch them send!");
  }
}

resetBounced();
