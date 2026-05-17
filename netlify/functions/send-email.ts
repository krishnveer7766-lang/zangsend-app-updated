import { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { to, subject, html, from_email, app_password, sender_name, attachment, contact_id, auth_type } = JSON.parse(event.body || '{}');

    if (!to || !subject || !html || !from_email || !app_password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const fromHeader = sender_name && String(sender_name).trim()
      ? `"${sender_name}" <${from_email}>`
      : from_email;

    let finalHtml = html;
    
    // Tracking logic
    if (contact_id) {
      const siteUrl = process.env.URL || 'https://zangsend.netlify.app';
      const trackingEndpoint = `${siteUrl}/api/track`;
      
      // 1. Wrap links for click tracking
      finalHtml = finalHtml.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi, (match, quote, url) => {
        if (url.startsWith('http')) {
          const trackedUrl = `${trackingEndpoint}?type=click&cid=${contact_id}&url=${encodeURIComponent(url)}`;
          return `<a href="${trackedUrl}"`;
        }
        return match;
      });

      // 2. Add open tracking pixel
      finalHtml += `<img src="${trackingEndpoint}?type=open&cid=${contact_id}" width="1" height="1" style="display:none !important;" />`;
    }

    // BUG FIX 1.4: Use auth_type field for more reliable detection
    const isOAuth = auth_type === 'oauth' || (app_password.length > 50 && auth_type !== 'app_password');
    const oauthClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '495214771463-bfil484vu8nct7r4caru65l94pa7jqbb.apps.googleusercontent.com';
    const oauthClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || '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';

    if (isOAuth && (!oauthClientId || !oauthClientSecret)) {
      throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: isOAuth ? {
        type: 'OAuth2',
        user: from_email,
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        refreshToken: app_password
      } : {
        user: from_email,
        pass: app_password
      }
    });

    const mailOptions: any = {
      from: fromHeader,
      to,
      subject,
      html: finalHtml
    };

    if (attachment) {
      mailOptions.attachments = [attachment];
    }

    const info = await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, messageId: info.messageId }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
