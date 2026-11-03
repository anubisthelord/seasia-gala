
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { Buffer } from "node:buffer";

function getEncryptionKey(): Buffer {
  const key = process.env.QR_TOKEN_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      "QR_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key"
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Generate a cryptographically secure QR token.
 */
export function generateQrToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Create a SHA-256 hash for database lookup.
 */
export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Encrypt a token using AES-256-GCM.
 */
export function encryptQrToken(token: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt a previously encrypted QR token.
 */
export function decryptQrToken(encryptedToken: string): string {
  const parts = encryptedToken.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted QR token format");
  }

  const ivPart = parts[0] as string;
  const authTagPart = parts[1] as string;
  const encryptedPart = parts[2] as string;

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");

  if (iv.length !== 12 || authTag.length !== 16 || encrypted.length === 0) {
    throw new Error("Invalid encrypted QR token data");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Compare a scanned token against its stored hash.
 */
export function verifyQrToken(
  token: string,
  storedHash: string
): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(storedHash)) {
    return false;
  }

  const tokenHash = Buffer.from(hashQrToken(token), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");

  if (tokenHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(tokenHash, expectedHash);
}
