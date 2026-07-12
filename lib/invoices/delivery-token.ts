import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTE_LENGTH = 32;

export function hashDeliveryToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateDeliveryToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
  return { token, tokenHash: hashDeliveryToken(token) };
}

export function isValidDeliveryTokenFormat(token: string): boolean {
  if (!token || token.length < 32) {
    return false;
  }

  return /^[A-Za-z0-9_-]+$/.test(token);
}

export function tokensMatchConstantTime(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export const DELIVERY_TOKEN_ENTROPY_BYTES = TOKEN_BYTE_LENGTH;
