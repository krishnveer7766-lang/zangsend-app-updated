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

async function cleanupCron() {
  console.log("⚡ Executing pg_cron cleanup on Supabase...");
  
  // Unschedule the process-queue background cron jobs
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT cron.unschedule(jobid) FROM cron.job WHERE command LIKE '%process-queue%';"
  });

  if (error) {
    console.error("❌ Failed to unschedule cron jobs:", error.message);
  } else {
    console.log("✅ Success! Conflicting Supabase cron jobs have been unscheduled.");
    console.log("Details:", JSON.stringify(data, null, 2));
  }
}

cleanupCron();
