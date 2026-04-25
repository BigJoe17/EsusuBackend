import { Resend } from "resend";
import { logger } from "./logger";

// Initialize Resend client
// In dev without a key, we just log the email (and optionally show OTP in API response)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email via Resend.
 * If RESEND_API_KEY is not set (dev mode), we log the email instead.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const from =
    process.env.EMAIL_FROM || "Esusu Digital <onboarding@resend.dev>";

  if (!resend) {
    logger.warn(
      `[EMAIL - DEV MOCK] To: ${options.to} | Subject: ${options.subject}`
    );
    logger.info(`[EMAIL - DEV MOCK] Body: ${options.text}`);
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    if (error) {
      logger.error("📧 Resend email error:", new Error(JSON.stringify(error)));
    } else {
      logger.info(`📧 Email sent via Resend: ${data?.id} → ${options.to}`);
    }
  } catch (error) {
    logger.error("📧 Failed to send email:", error as Error);
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

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(email: string, otpCode: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Esusu Digital — Password Reset Code",
    text: `Your password reset code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Esusu Digital</h2>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Password Reset Request</p>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">${otpCode}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          This code expires in <strong>10 minutes</strong>.<br/>
          If you did not request a password reset, please ignore this email.
        </p>
      </div>
    `,
  });
}
