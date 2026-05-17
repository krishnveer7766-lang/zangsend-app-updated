import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBounced() {
    console.log("Checking bounced contacts...");
    const { data, error } = await supabase
        .from('contacts')
        .select('id, email, status, scheduled_send_at, data')
        .eq('status', 'bounced')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} bounced contacts:`);
    for (const contact of data) {
        console.log(`ID: ${contact.id}`);
        console.log(`Email: ${contact.email}`);
        console.log(`Status: ${contact.status}`);
        console.log(`Scheduled Send At: ${contact.scheduled_send_at}`);
        console.log(`Data (containing error):`, JSON.stringify(contact.data, null, 2));
        console.log('--------------------------------------------------');
    }
}

checkBounced();
