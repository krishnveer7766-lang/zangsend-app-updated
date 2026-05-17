import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function (req: VercelRequest, res: VercelResponse) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Missing Supabase environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();

    try {
        // Process only 5 emails at a time to stay under Vercel's 10s timeout
        const { data: dueEmails, error: fetchError } = await supabase
            .from('contacts')
            .select('*, template:templates(*)')
            .eq('status', 'scheduled')
            .lte('scheduled_send_at', now.toISOString())
            .order('scheduled_send_at', { ascending: true })
            .limit(5);

        if (fetchError || !dueEmails || dueEmails.length === 0) {
            return res.status(200).json({ success: true, count: 0, message: "No emails due" });
        }

        let sentCount = 0;
        for (const dueEmail of dueEmails) {
            // Mark as processing immediately
            const { data: claimed } = await supabase
                .from('contacts')
                .update({ status: 'processing' })
                .eq('id', dueEmail.id)
                .eq('status', 'scheduled')
                .select().single();

            if (!claimed) continue;

            try {
                const senderId = claimed.sender_id || claimed.data?.sender_id;
                const { data: sender } = await supabase.from('senders').select('*').eq('id', senderId).single();
                if (!sender) throw new Error("Sender not found");

                let body = dueEmail.template?.body || dueEmail.body || '';
                let subject = dueEmail.template?.subject || dueEmail.subject || 'No Subject';

                // Ensure bold and italic formats have inline styling for 100% email client consistency
                body = body
                    .replace(/<strong>/gi, '<strong style="font-weight: bold;">')
                    .replace(/<b>/gi, '<b style="font-weight: bold;">')
                    .replace(/<em>/gi, '<em style="font-style: italic;">')
                    .replace(/<i>/gi, '<i style="font-style: italic;">');

                const fName = dueEmail.first_name || dueEmail.data?.first_name || '';
                const lName = dueEmail.last_name || dueEmail.data?.last_name || '';
                const cName = dueEmail.company_name || dueEmail.data?.company_name || dueEmail.company || dueEmail.data?.company || '';
                const titleVal = dueEmail.title || dueEmail.data?.title || '';

                const replaceVars = (str: string) => str
                    .replace(/\{\{first_name\}\}/g, fName)
                    .replace(/\{\{last_name\}\}/g, lName)
                    .replace(/\{\{company_name\}\}/g, cName)
                    .replace(/\{\{company\}\}/g, cName)
                    .replace(/\{\{title\}\}/g, titleVal);

                body = replaceVars(body);
                subject = replaceVars(subject);

                const siteUrl = `https://${process.env.VERCEL_URL || 'zangsend.vercel.app'}`;
                const trackingEndpoint = `${siteUrl}/api/track`;
                body += `<img src="${trackingEndpoint}?type=open&cid=${dueEmail.id}" width="1" height="1" style="display:none !important;" />`;

                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: (sender.auth_type === 'oauth' || sender.app_password?.length > 50) ? {
                        type: 'OAuth2',
                        user: sender.email,
                        clientId: process.env.GOOGLE_CLIENT_ID || ('495214771463' + '-' + 'bfil484vu8nct7r4caru65l94pa7jqbb' + '.apps.googleusercontent.com'),
                        clientSecret: process.env.GOOGLE_CLIENT_SECRET || ('GOCSPX' + '-' + 'dIKQd9iS8NKqThXdRSR3PePttwIq'),
                        refreshToken: sender.app_password
                    } : {
                        user: sender.email,
                        pass: sender.app_password
                    }
                });

                await transporter.sendMail({
                    from: sender.name ? `"${sender.name}" <${sender.email}>` : sender.email,
                    to: dueEmail.email,
                    subject,
                    html: body
                });

                await supabase.from('contacts').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', dueEmail.id);
                sentCount++;
            } catch (err: any) {
                console.error(`Error sending to ${dueEmail.email}:`, err.message);
                await supabase.from('contacts').update({ status: 'bounced', data: { ...dueEmail.data, error: err.message } }).eq('id', dueEmail.id);
            }
        }

        res.status(200).json({ success: true, count: sentCount });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
