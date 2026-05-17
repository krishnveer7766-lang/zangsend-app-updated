import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function tryExec() {
  console.log("Calling exec_sql RPC to check database columns...");
  
  // Try to check contacts table structure or add column directly
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES public.senders(id) ON DELETE SET NULL;"
  });

  if (error) {
    console.error("RPC exec_sql failed or was not found:", error.message);
  } else {
    console.log("✅ Success! RPC executed and returned:", data);
  }
}

tryExec();
