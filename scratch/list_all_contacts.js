import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, status, scheduled_send_at, user_id, list_id');

  if (error) {
    console.error("Error fetching contacts:", error);
    return;
  }

  console.log(`Total contacts found: ${data.length}`);
  const statusCounts = {};
  data.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });
  console.log("Status breakdown:", statusCounts);

  const scheduled = data.filter(c => c.scheduled_send_at !== null);
  console.log(`Contacts with scheduled_send_at !== null: ${scheduled.length}`);
  if (scheduled.length > 0) {
    console.log("First 5 scheduled contacts:");
    console.log(scheduled.slice(0, 5));
  } else {
    // Print the first 5 contacts of any status to see their fields
    console.log("First 5 contacts of any status:");
    console.log(data.slice(0, 5));
  }
}

list();
