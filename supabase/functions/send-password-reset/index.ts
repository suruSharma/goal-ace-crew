import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generic success response — identical whether or not the user exists (prevents user enumeration)
const SUCCESS_RESPONSE = JSON.stringify({
  success: true,
  message: "If an account exists with this email, you will receive a reset link.",
});

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface PasswordResetRequest {
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Paginate through all users to find the matching email
    let user: { id: string; email?: string } | undefined;
    let page = 1;
    const perPage = 1000;

    while (!user) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("Error fetching users during password reset");
        return new Response(SUCCESS_RESPONSE, {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (data.users.length < perPage) break; // no more pages
      page++;
    }

    if (!user) {
      // Always return success to prevent user enumeration attacks
      return new Response(SUCCESS_RESPONSE, {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the user's profile name for the email greeting
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Generate password reset link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: user.email!,
      options: {
        redirectTo: `${req.headers.get("origin")}/auth?reset=true`,
      },
    });

    if (linkError || !linkData.properties?.action_link) {
      console.error("Error generating reset link");
      return new Response(SUCCESS_RESPONSE, {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const resetLink = linkData.properties.action_link;

    // Sanitize user-supplied data before embedding in HTML to prevent XSS
    const safeName = escapeHtml(profile?.full_name ?? "there");

    // Send email via Resend
    await resend.emails.send({
      from: "75 Hard <onboarding@resend.dev>",
      to: [email],
      subject: "Reset your 75 Hard password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #10b981; margin: 0; font-size: 24px;">&#x1F525; 75 Hard</h1>
            </div>
            <h2 style="margin: 0 0 16px; font-size: 20px; color: #f1f5f9;">Reset your password</h2>
            <p style="margin: 0 0 24px; color: #94a3b8; line-height: 1.6;">
              Hey ${safeName}! You requested a password reset for your 75 Hard account.
            </p>
            <a href="${resetLink}" style="display: block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; text-align: center; font-weight: 600; margin-bottom: 24px;">
              Reset Password
            </a>
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
              If you didn't request this, you can safely ignore this email. This link will expire in 24 hours.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(SUCCESS_RESPONSE, {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (_error: unknown) {
    // Never expose internal error details in production
    console.error("Unhandled error in send-password-reset");
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
