import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import nodemailer from "npm:nodemailer";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Convert Blob to Base64 in Deno
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  console.log("Queue processor started...");

  try {
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    // Fetch up to 10 due emails
    const { data: dueEmails, error: fetchError } = await supabase
      .from('contacts')
      .select('*, template:templates(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_send_at', now.toISOString())
      .order('scheduled_send_at', { ascending: true })
      .limit(10);

    if (fetchError || !dueEmails || dueEmails.length === 0) {
      return new Response(JSON.stringify({ msg: "No emails due", count: 0 }), { status: 200 });
    }

    console.log(`Found ${dueEmails.length} emails to process.`);
    let sentCount = 0;

    for (const dueEmail of dueEmails) {
      // 1. Claim
      const { data: claimed, error: claimError } = await supabase
        .from('contacts')
        .update({ status: 'processing' })
        .eq('id', dueEmail.id)
        .eq('status', 'scheduled')
        .select()
        .single();

      if (claimError || !claimed) continue;

      try {
        const senderId = (dueEmail as any)?.sender_id || (dueEmail as any)?.data?.sender_id;
        if (!senderId) throw new Error("Sender ID missing on contact");

        // 2. Get Sender
        const { data: sender, error: senderError } = await supabase
          .from('senders')
          .select('*')
          .eq('id', senderId)
          .single();

        if (senderError || !sender) throw new Error("Sender not found");

        // 3. Prepare Content
        let body = dueEmail.template?.body || dueEmail.body || '';
        let subject = dueEmail.template?.subject || dueEmail.subject || 'No Subject';

        body = body
          .replace(/\{\{first_name\}\}/g, dueEmail.first_name || '')
          .replace(/\{\{last_name\}\}/g, dueEmail.last_name || '')
          .replace(/\{\{company_name\}\}/g, dueEmail.company_name || '')
          .replace(/\{\{title\}\}/g, dueEmail.title || '');

        const trackingEndpoint = 'https://hdfbgixlgofjafkgfkin.supabase.co/functions/v1/track';
        body = body.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi, (match, quote, url) => {
          if (url.startsWith('http')) {
            return `<a href="${trackingEndpoint}?type=click&cid=${dueEmail.id}&url=${encodeURIComponent(url)}"`;
          }
          return match;
        });
        body += `<img src="${trackingEndpoint}?type=open&cid=${dueEmail.id}" width="1" height="1" style="display:none !important;" />`;

        // 4. Attachments (Download as Base64 to avoid URL access issues)
        const attachments = [];
        const templateAttachmentIds = Array.isArray(dueEmail.template?.attachment_ids)
          ? dueEmail.template.attachment_ids
          : [];
        const targetAttachmentId = dueEmail.attachment_id || templateAttachmentIds[0];
        if (targetAttachmentId) {
          const { data: attachmentInfo } = await supabase.from('attachments').select('*').eq('id', targetAttachmentId).single();
          if (attachmentInfo?.storage_path) {
            const { data: fileData, error: downloadError } = await supabase.storage.from('attachments').download(attachmentInfo.storage_path);
            if (!downloadError && fileData) {
              const base64 = await blobToBase64(fileData);
              attachments.push({
                filename: attachmentInfo.filename || 'Attachment',
                content: base64,
                encoding: 'base64'
              });
            }
          }
        }

        // 5. Send
        const isOAuth = sender.app_password.length > 50;
        const g_cid = Deno.env.get('GOOGLE_CLIENT_ID') || '495214771463-bfil484vu8nct7r4caru65l94pa7jqbb.apps.googleusercontent.com';
        const g_csec = Deno.env.get('GOOGLE_CLIENT_SECRET') || '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';
        if (isOAuth && (!g_cid || !g_csec)) {
          throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
        }
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: isOAuth ? {
            type: 'OAuth2',
            user: sender.email,
            clientId: g_cid,
            clientSecret: g_csec,
            refreshToken: sender.app_password
          } : {
            user: sender.email,
            pass: sender.app_password
          }
        });

        const fromHeader = (sender.name || sender.sender_name)
          ? `"${sender.name || sender.sender_name}" <${sender.email}>`
          : sender.email;

        await transporter.sendMail({
          from: fromHeader,
          to: dueEmail.email,
          subject,
          html: body,
          attachments
        });

        await supabase.from('contacts').update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        }).eq('id', dueEmail.id);
        sentCount++;

      } catch (err) {
        console.error(`Error processing ${dueEmail.email}:`, err.message);
        await supabase.from('contacts').update({ 
          status: 'bounced',
          data: { ...(dueEmail.data || {}), last_error: err.message }
        }).eq('id', dueEmail.id);
      }
    }

    return new Response(JSON.stringify({ msg: "Done", count: sentCount }), { status: 200 });

  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
});
