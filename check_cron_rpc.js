import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCron() {
  console.log("Querying pg_cron via exec_sql RPC...");
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT jobid, schedule, command, nodename, nodeport, database, username, active FROM cron.job;"
  });

  if (error) {
    console.error("Error executing query:", error.message);
  } else {
    console.log("✅ Active Cron Jobs in database:");
    console.log(JSON.stringify(data, null, 2));
  }
}

checkCron();
