
import { createHash, randomInt } from "node:crypto";

export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashOtp(email: string, otp: string): string {
  const secret = process.env.OTP_HASH_SECRET;

  if (!secret) {
    throw new Error("OTP_HASH_SECRET is missing");
  }

  return createHash("sha256")
    .update(`${email.toLowerCase().trim()}:${otp}:${secret}`)
    .digest("hex");
}
