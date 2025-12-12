import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  username: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username }: PasswordResetRequest = await req.json();
    
    if (!username) {
      console.error("Missing username in request");
      return new Response(
        JSON.stringify({ error: "Username is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Password reset requested for username: ${username}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Convert username to fake email
    const fakeEmail = `${username.toLowerCase()}@75hard.app`;

    // Look up user by fake email
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      throw userError;
    }

    const user = users.find(u => u.email === fakeEmail);
    
    if (!user) {
      console.log(`No user found for username: ${username}`);
      // Return success even if user not found (security best practice)
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists with this username and has a recovery email, you will receive a reset link." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the user's profile to find recovery email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('recovery_email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw profileError;
    }

    if (!profile?.recovery_email) {
      console.log(`No recovery email set for username: ${username}`);
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists with this username and has a recovery email, you will receive a reset link." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found recovery email for user ${username}, generating reset link`);

    // Generate password reset link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: fakeEmail,
      options: {
        redirectTo: `${req.headers.get('origin')}/auth?reset=true`,
      }
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      throw linkError;
    }

    const resetLink = linkData.properties?.action_link;
    
    if (!resetLink) {
      console.error("No reset link generated");
      throw new Error("Failed to generate reset link");
    }

    console.log("Reset link generated, sending email...");

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "75 Hard <onboarding@resend.dev>",
      to: [profile.recovery_email],
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
              <h1 style="color: #10b981; margin: 0; font-size: 24px;">🔥 75 Hard</h1>
            </div>
            <h2 style="margin: 0 0 16px; font-size: 20px; color: #f1f5f9;">Reset your password</h2>
            <p style="margin: 0 0 24px; color: #94a3b8; line-height: 1.6;">
              Hey ${profile.full_name || username}! You requested a password reset for your 75 Hard account.
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "If an account exists with this username and has a recovery email, you will receive a reset link." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
