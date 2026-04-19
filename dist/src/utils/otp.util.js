"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOtpCode = generateOtpCode;
exports.hashOtp = hashOtp;
exports.compareOtp = compareOtp;
exports.getOtpExpiry = getOtpExpiry;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
/**
 * Generate a cryptographically random 6-digit OTP code.
 */
function generateOtpCode() {
    // Generate a random number between 100000 and 999999
    const code = crypto_1.default.randomInt(100000, 999999);
    return code.toString();
}
/**
 * Hash an OTP code using bcrypt for secure storage.
 */
async function hashOtp(code) {
    const salt = await bcrypt_1.default.genSalt(10);
    return bcrypt_1.default.hash(code, salt);
}
/**
 * Compare a plain OTP code against a bcrypt hash.
 */
async function compareOtp(code, hash) {
    return bcrypt_1.default.compare(code, hash);
}
/**
 * Get the OTP expiry time (10 minutes from now).
 */
function getOtpExpiry() {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10);
    return expiry;
}
