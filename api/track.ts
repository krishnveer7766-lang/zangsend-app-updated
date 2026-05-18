import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function (req: VercelRequest, res: VercelResponse) {
    const { type, cid, url } = req.query;
    if (!cid) return res.status(400).send('Missing contact id');

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const now = new Date().toISOString();

        if (type === 'open') {
            const { data: contact } = await supabase.from('contacts').select('data').eq('id', cid).single();
            const currentData = contact?.data || {};
            const activity = currentData.activity || {};
            
            if (!activity.opened_at) {
                await supabase.from('contacts').update({
                    opened_at: now,
                    data: { ...currentData, activity: { ...activity, opened_at: now } }
                }).eq('id', cid);
            }
            
            const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            res.setHeader('Content-Type', 'image/gif');
            return res.status(200).send(pixel);
        } else if (type === 'click' && url) {
            const { data: contact } = await supabase.from('contacts').select('data').eq('id', cid).single();
            const currentData = contact?.data || {};
            const activity = currentData.activity || {};
            
            if (!activity.clicked_at) {
                await supabase.from('contacts').update({
                    clicked_at: now,
                    data: { ...currentData, activity: { ...activity, clicked_at: now } }
                }).eq('id', cid);
            }

            return res.redirect(302, url as string);
        }

        res.status(400).send('Invalid track type');
    } catch (err: any) {
        res.status(500).send(err.message);
    }
}
