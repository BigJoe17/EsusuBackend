import nodemailer from "nodemailer";

// Configure the email transporter.
// For development, use Ethereal (fake SMTP) if no real credentials are set.
// For production, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email using the configured transporter.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Esusu Digital" <noreply@esusu.com>',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent: ${info.messageId}`);

    // If using Ethereal, log the preview URL
    if (process.env.SMTP_HOST === undefined || process.env.SMTP_HOST === "smtp.ethereal.email") {
      console.log(`📧 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    console.error("📧 Failed to send email:", error);
    // Don't throw — OTP is also returned in response for dev purposes
  }
}

/**
 * Send an OTP verification email.
 */
export async function sendOtpEmail(email: string, otpCode: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Esusu Digital — Your Verification Code",
    text: `Your OTP verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request this code, please ignore this email.`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Esusu Digital</h2>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Your verification code</p>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">${otpCode}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          This code expires in <strong>10 minutes</strong>.<br/>
          If you did not request this code, please ignore this email.
        </p>
      </div>
    `,
  });
}
