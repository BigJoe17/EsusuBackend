/**
 * Validation Schemas using simple type checking
 * (Alternative to Zod for minimal dependencies)
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Min 8 chars, at least 1 number, 1 uppercase
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate registration payload
 */
export function validateRegistration(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.email || typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email is required and must be a string" });
  } else if (!validateEmail(data.email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }

  if (!data.password || typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password is required and must be a string" });
  } else {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      errors.push({
        field: "password",
        message: passwordValidation.errors.join(", "),
      });
    }
  }

  if (data.name && typeof data.name !== "string") {
    errors.push({ field: "name", message: "Name must be a string" });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate login payload
 */
export function validateLogin(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.email || typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!validateEmail(data.email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }

  if (!data.password || typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password is required" });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate OTP verification
 */
export function validateOtpVerification(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.email || typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email is required" });
  }

  if (!data.otp || typeof data.otp !== "string" || data.otp.length !== 6) {
    errors.push({ field: "otp", message: "OTP must be a 6-digit code" });
  } else if (!/^\d{6}$/.test(data.otp)) {
    errors.push({ field: "otp", message: "OTP must contain only numbers" });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate loan request
 */
export function validateLoanRequest(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.amount || typeof data.amount !== "number") {
    errors.push({ field: "amount", message: "Amount must be a number" });
  } else if (data.amount <= 0) {
    errors.push({ field: "amount", message: "Amount must be greater than 0" });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate contribution request
 */
export function validateContribution(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.groupId || typeof data.groupId !== "string") {
    errors.push({ field: "groupId", message: "Group ID is required" });
  }

  if (!data.amount || typeof data.amount !== "number") {
    errors.push({ field: "amount", message: "Amount must be a number" });
  } else if (data.amount <= 0) {
    errors.push({ field: "amount", message: "Amount must be greater than 0" });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
