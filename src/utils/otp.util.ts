import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Generate a cryptographically random 6-digit OTP code.
 */
export function generateOtpCode(): string {
  // Generate a random number between 100000 and 999999
  const code = crypto.randomInt(100000, 999999);
  return code.toString();
}

/**
 * Hash an OTP code using bcrypt for secure storage.
 */
export async function hashOtp(code: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(code, salt);
}

/**
 * Compare a plain OTP code against a bcrypt hash.
 */
export async function compareOtp(
  code: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Get the OTP expiry time (10 minutes from now).
 */
export function getOtpExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10);
  return expiry;
}
