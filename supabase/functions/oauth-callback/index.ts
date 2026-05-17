import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
}

const G_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '495214771463-bfil484vu8nct7r4caru65l94pa7jqbb.apps.googleusercontent.com';
const G_SEC = Deno.env.get('GOOGLE_CLIENT_SECRET') || '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';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state');

  if (!code || !userId) {
    return new Response("Missing code or state. Expected OAuth callback.", { status: 400 });
  }

  try {
    if (!G_ID || !G_SEC) {
      return new Response("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET secrets.", { status: 500 });
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: G_ID,
        client_secret: G_SEC,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: 'https://hdfbgixlgofjafkgfkin.supabase.co/functions/v1/oauth-callback'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.refresh_token) {
      return new Response(`OAuth Error: No refresh token received. Google responded with: ${JSON.stringify(tokenData)}. Please make sure to check the box to allow email permissions when signing in.`, { status: 400 });
    }

    // Get user email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userInfoRes.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save to senders table
    const { error } = await supabase.from('senders').insert({
      user_id: userId,
      email: userInfo.email,
      app_password: tokenData.refresh_token // Store refresh token in app_password column
    });

    if (error) {
      console.error("DB Error:", error);
      return new Response("Failed to save sender to database", { status: 500 });
    }

    // Redirect user back to the app settings page
    // Using local IP or production URL depending on origin
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';
    return Response.redirect(`${appBaseUrl}/settings?success=1`, 302);
  } catch (error) {
    console.error("OAuth error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
})
