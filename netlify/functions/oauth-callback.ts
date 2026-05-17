import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event) => {
  const { code, state } = event.queryStringParameters || {};

  if (!code || !state) {
    return { statusCode: 400, body: 'Missing code or state' };
  }

  try {
    // Prefer the same project URL used by the frontend to avoid cross-project writes.
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase env: VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: process.env.REDIRECT_URI || 'https://zangsend.vercel.app/api/oauth-callback',
        grant_type: 'authorization_code'
      })
    });

    const tokenData: any = await tokenRes.json();

    if (!tokenData.refresh_token) {
      console.error('No refresh token returned:', tokenData);
      // If no refresh token, maybe we already have one or user didn't grant offline access
    }

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData: any = await userRes.json();

    // state contains authenticated app user id from frontend OAuth request.
    // Create sender row; if it already exists, update token/status.
    const { error: insertError } = await supabase
      .from('senders')
      .insert({
        user_id: state,
        email: userData.email,
        app_password: tokenData.refresh_token || '',
        name: userData.name || '',
      });

    if (insertError) {
      const { error: updateError } = await supabase
        .from('senders')
        .update({
          app_password: tokenData.refresh_token || '',
          name: userData.name || '',
        })
        .eq('user_id', state)
        .eq('email', userData.email);

      if (updateError) throw updateError;
    }

    // Verify row exists before reporting success to the UI.
    const { data: savedRow, error: verifyError } = await supabase
      .from('senders')
      .select('id')
      .eq('user_id', state)
      .eq('email', userData.email)
      .maybeSingle();

    if (verifyError || !savedRow) {
      throw new Error('Sender save verification failed');
    }

    return {
      statusCode: 302,
      headers: {
        Location: '/settings?success=1',
      },
      body: '',
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: `Error: ${err.message}`,
    };
  }
};
