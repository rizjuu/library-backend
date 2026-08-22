const nodemailer = require("nodemailer");

function createTransporter() {
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || "";
  const pass = rawPass.replace(/\s+/g, ""); // Strip spaces from Gmail App Password

  if (!user || !pass) {
    console.warn("[Email Transporter Warning]: SMTP_USER or SMTP_PASS missing in environment variables.");
    return null;
  }

  const host = (process.env.SMTP_HOST || "").toLowerCase();
  const isGmail = host.includes("gmail") || user.endsWith("@gmail.com");

  if (isGmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass }
    });
  }

  const port = parseInt(process.env.SMTP_PORT || "587");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    }
  });
}

async function sendSignInNotificationEmail(recipientEmail, userName = "Patron") {
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
  
  const fromAddress = user
    ? `"Misamis Oriental Public Library" <${user}>`
    : (process.env.SMTP_FROM || '"Misamis Oriental Public Library" <noreply@mopl.gov.ph>');

  const now = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "full",
    timeStyle: "short"
  });

  const mailOptions = {
    from: fromAddress,
    to: recipientEmail,
    subject: "Signed in to Misamis Oriental Provincial Capitol Public Library",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
          <h2 style="color: #1e3a8a; margin: 0;">📚 Misamis Oriental Public Library</h2>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Provincial Capitol Public Library Portal</p>
        </div>
        
        <div style="padding: 30px 10px; color: #334155;">
          <h3 style="color: #0f172a; margin-top: 0;">Sign-In Confirmation</h3>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>You have successfully signed in to the <strong>Misamis Oriental Provincial Capitol Public Library System</strong> on <strong>${now}</strong>.</p>
          <p>Your account (<strong>${recipientEmail}</strong>) is active. You can now explore the digital catalog, view available titles, and check your loan records.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 18px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 13.5px; color: #475569;">
              ℹ️ <strong>Security Tip:</strong> If you did not initiate this sign-in, please notify library staff or contact administration immediately.
            </p>
          </div>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
          © 2026 Misamis Oriental Provincial Capitol Public Library · All rights reserved.
        </div>
      </div>
    `
  };

  const transporter = createTransporter();

  if (!transporter) {
    console.warn(`[Email] No SMTP credentials configured. Skipping sign-in notification for ${recipientEmail}.`);
    return { success: false, reason: "NO_SMTP" };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Sign-in notification successfully delivered to ${recipientEmail}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Dispatch Error]:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendSignInNotificationEmail };
