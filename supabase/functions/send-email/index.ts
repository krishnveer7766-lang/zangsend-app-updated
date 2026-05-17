import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      to,
      subject,
      html,
      from_email,
      app_password,
      sender_name,
      attachment,
      contact_id,
    } = await req.json();

    if (!to || !subject || !html || !from_email || !app_password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let finalHtml = html;
    if (contact_id) {
      const trackingEndpoint = "https://hdfbgixlgofjafkgfkin.supabase.co/functions/v1/track";
      finalHtml = finalHtml.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi, (match: string, _q: string, url: string) => {
        if (url.startsWith("http")) {
          const trackedUrl = `${trackingEndpoint}?type=click&cid=${contact_id}&url=${encodeURIComponent(url)}`;
          return `<a href="${trackedUrl}"`;
        }
        return match;
      });
      finalHtml += `<img src="${trackingEndpoint}?type=open&cid=${contact_id}" width="1" height="1" style="display:none !important;" />`;
    }

    const isOAuth = String(app_password).length > 50;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: isOAuth
        ? {
            type: "OAuth2",
            user: from_email,
            clientId: Deno.env.get("GOOGLE_CLIENT_ID") || "495214771463-bfil484vu8nct7r4caru65l94pa7jqbb.apps.googleusercontent.com",
            clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "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",
            refreshToken: app_password,
          }
        : {
            user: from_email,
            pass: app_password,
          },
    });

    const fromHeader = sender_name && String(sender_name).trim()
      ? `"${sender_name}" <${from_email}>`
      : from_email;

    const mailOptions: any = {
      from: fromHeader,
      to,
      subject,
      html: finalHtml,
    };

    if (attachment) {
      mailOptions.attachments = [attachment];
    }

    const info = await transporter.sendMail(mailOptions);
    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Send failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

