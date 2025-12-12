import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Welcome email function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name }: WelcomeEmailRequest = await req.json();
    
    console.log(`Sending welcome email to: ${email}, name: ${name}`);

    if (!email) {
      console.error("No email provided");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = name || "Warrior";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "75 Hard <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to 75 Hard! Your Journey Begins Now 🔥",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border-radius: 16px; border: 1px solid #2a2a2a; overflow: hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px; text-align: center;">
                        <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                          <span style="font-size: 28px;">🔥</span>
                        </div>
                        <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 10px; font-weight: bold;">
                          Welcome, ${userName}!
                        </h1>
                        <p style="color: #10b981; font-size: 16px; margin: 0; font-weight: 600;">
                          Your 75 Hard Journey Begins Now
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                      <td style="padding: 20px 40px;">
                        <p style="color: #a1a1a1; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                          You've taken the first step towards transforming yourself. The 75 Hard challenge isn't just about physical fitness – it's about building mental toughness that will last a lifetime.
                        </p>
                        
                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
                          <h3 style="color: #10b981; font-size: 16px; margin: 0 0 12px; font-weight: 600;">
                            💪 Your Daily Tasks
                          </h3>
                          <ul style="color: #a1a1a1; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>Two 45-minute workouts (one must be outdoors)</li>
                            <li>Follow a diet with no cheat meals</li>
                            <li>Drink 1 gallon of water</li>
                            <li>Read 10 pages of non-fiction</li>
                            <li>Take a progress photo</li>
                            <li>No alcohol</li>
                          </ul>
                        </div>
                        
                        <p style="color: #a1a1a1; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                          Remember: <strong style="color: #ffffff;">Consistency is key.</strong> Show up every single day, even when it's hard – especially when it's hard.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Quote -->
                    <tr>
                      <td style="padding: 0 40px 30px;">
                        <div style="border-top: 1px solid #2a2a2a; padding-top: 20px; text-align: center;">
                          <p style="color: #6b7280; font-size: 14px; font-style: italic; margin: 0;">
                            "The only easy day was yesterday."
                          </p>
                          <p style="color: #4b5563; font-size: 12px; margin: 8px 0 0;">
                            — Navy SEALs
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 20px 40px; background: #0d0d0d; text-align: center;">
                        <p style="color: #4b5563; font-size: 12px; margin: 0;">
                          Stay hard. 🔥
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    const result = await emailResponse.json();
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
