import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCron() {
    console.log("Checking Supabase pg_cron jobs...");
    const { data, error } = await supabase
        .from('cron.job')
        .select('*');

    if (error) {
        // If the 'cron.job' table isn't directly exposed via PostgREST, we can try running an RPC if one exists,
        // or we can see the schema. Let's print the error.
        console.error("PostgREST Error accessing cron.job (this is normal if not exposed to API):", error.message);
        
        // Let's try to query public tables/triggers instead.
        console.log("Checking triggers on the contacts table...");
        const { data: triggers, error: trigError } = await supabase.rpc('get_triggers');
        if (trigError) {
            console.error("Error fetching triggers:", trigError.message);
        } else {
            console.log("Triggers:", triggers);
        }
        return;
    }

    console.log("Active Cron Jobs:", data);
}

checkCron();
