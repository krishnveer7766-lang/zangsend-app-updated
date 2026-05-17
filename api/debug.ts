import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function (req: VercelRequest, res: VercelResponse) {
    const debugInfo = {
        envKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY')),
        hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeVersion: process.version,
    };

    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: "SELECT cron.unschedule(jobid) FROM cron.job WHERE command LIKE '%process-queue%';"
        });
        
        res.status(200).json({
            status: "ok",
            debugInfo,
            unscheduledResult: error ? { error: error.message } : data
        });
    } catch (err: any) {
        res.status(500).json({
            status: "error",
            debugInfo,
            error: err.message,
            stack: err.stack
        });
    }
}
