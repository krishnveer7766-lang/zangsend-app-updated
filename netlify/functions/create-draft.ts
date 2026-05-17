import { Handler } from '@netlify/functions';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    };
  }

  try {
    const { to, subject, html, from_email, app_password, sender_name, attachment_url, attachment_filename, auth_type } = JSON.parse(event.body || '{}');

    if (!to || !html || !from_email || !app_password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows'
    });

    const fromHeader = sender_name && String(sender_name).trim()
      ? `"${sender_name}" <${from_email}>`
      : from_email;

    // Ensure bold and italic formats have inline styling for 100% email client consistency
    const processedHtml = String(html)
      .replace(/<strong>/gi, '<strong style="font-weight: bold;">')
      .replace(/<b>/gi, '<b style="font-weight: bold;">')
      .replace(/<em>/gi, '<em style="font-style: italic;">')
      .replace(/<i>/gi, '<i style="font-style: italic;">');

    const mailOptions: any = {
      from: fromHeader,
      to,
      subject: subject || 'No Subject',
      html: processedHtml,
    };

    if (attachment_url) {
      mailOptions.attachments = [
        {
          filename: attachment_filename || 'Attachment',
          path: attachment_url
        }
      ];
    }

    const rawMessage = await new Promise<string>((resolve, reject) => {
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) return reject(err);
        let raw = '';
        info.message.on('data', (chunk: Buffer) => {
          raw += chunk.toString();
        });
        info.message.on('end', () => resolve(raw));
      });
    });

    // BUG FIX 1.4: Improved OAuth detection
    const isOAuth = auth_type === 'oauth' || (app_password.length > 50 && auth_type !== 'app_password');
    let accessToken = undefined;

    if (isOAuth) {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: app_password,
          grant_type: 'refresh_token'
        })
      });
      const tokenData: any = await tokenRes.json();
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
      } else {
        throw new Error('Failed to refresh OAuth token for draft creation');
      }
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: isOAuth ? {
        user: from_email,
        accessToken: accessToken
      } : {
        user: from_email,
        pass: app_password
      },
      logger: false
    });

    await client.connect();

    try {
      // BUG FIX 2.3: Dynamic Drafts folder detection
      const mailboxes = await client.list();
      const draftBox = mailboxes.find(m => m.specialUse === '\\Drafts') || 
                       mailboxes.find(m => m.path.toLowerCase().includes('draft'));
      
      if (draftBox) {
        await client.append(draftBox.path, rawMessage, ['\\Draft']);
      } else {
        // Fallback
        try {
          await client.append('[Gmail]/Drafts', rawMessage, ['\\Draft']);
        } catch (e) {
          await client.append('Drafts', rawMessage, ['\\Draft']);
        }
      }
    } catch (e: any) {
      console.error('IMAP append error:', e.message);
      throw e;
    }

    await client.logout();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
