const nodemailer = require("nodemailer");

function createTransporter() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    tls: {
      rejectUnauthorized: false
    }
  });
}

async function sendMagicLinkEmail(recipientEmail, magicLink) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Misamis Oriental Public Library" <noreply@mopl.gov.ph>',
    to: recipientEmail,
    subject: "Sign in to Misamis Oriental Public Library",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
          <h2 style="color: #1e3a8a; margin: 0;">📚 Misamis Oriental Public Library</h2>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Provincial Capitol Public Library Portal</p>
        </div>
        
        <div style="padding: 30px 10px; color: #334155;">
          <h3 style="color: #0f172a; margin-top: 0;">Sign-In Request</h3>
          <p>Hello,</p>
          <p>We received a request to log in to your Patron account associated with <strong>${recipientEmail}</strong>.</p>
          <p>Click the button below to complete your authentication and access your Patron Dashboard:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
              Sign in to Patron Portal
            </a>
          </div>
          
          <p style="font-size: 13px; color: #64748b;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${magicLink}" style="color: #2563eb; word-break: break-all;">${magicLink}</a>
          </p>
          
          <p style="font-size: 13px; color: #94a3b8; margin-top: 25px;">
            This link will expire in 15 minutes. If you did not request this login, you can safely ignore this email.
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
          © 2026 Misamis Oriental Provincial Capitol Public Library · All rights reserved.
        </div>
      </div>
    `
  };

  const transporter = createTransporter();

  if (!transporter) {
    console.warn(`[Email] No SMTP credentials configured. Skipping email send for ${recipientEmail}.`);
    console.log(`[Magic Link URL]: ${magicLink}`);
    return { success: true, sent: false, reason: "NO_SMTP" };
  }

  try {
    // Send email with 5s max timeout to prevent hanging on serverless platforms like Vercel/Render
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email dispatch timed out after 5s")), 5000)
    );

    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[Email] Magic link email successfully sent to ${recipientEmail}. Message ID: ${info.messageId}`);
    return { success: true, sent: true };
  } catch (error) {
    console.error("[Email Error]:", error.message);
    console.log(`[Magic Link Fallback URL]: ${magicLink}`);
    return { success: true, sent: false, error: error.message };
  }
}

module.exports = { sendMagicLinkEmail };
