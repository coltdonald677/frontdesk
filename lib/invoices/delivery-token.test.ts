import { describe, expect, it } from "vitest";
import {
  DELIVERY_TOKEN_ENTROPY_BYTES,
  generateDeliveryToken,
  hashDeliveryToken,
  isValidDeliveryTokenFormat,
  tokensMatchConstantTime,
} from "@/lib/invoices/delivery-token";
import { buildPublicInvoiceUrl } from "@/lib/invoices/delivery-url";

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe("invoice delivery tokens", () => {
  it("generates high-entropy tokens and stores only a SHA-256 hash", () => {
    const { token, tokenHash } = generateDeliveryToken();

    expect(token).not.toBe(tokenHash);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDeliveryToken(token)).toBe(tokenHash);
    expect(DELIVERY_TOKEN_ENTROPY_BYTES).toBeGreaterThanOrEqual(32);
  });

  it("rejects invalid or low-entropy token formats", () => {
    expect(isValidDeliveryTokenFormat("")).toBe(false);
    expect(isValidDeliveryTokenFormat("short")).toBe(false);
    expect(isValidDeliveryTokenFormat("has spaces in token value")).toBe(false);
    expect(isValidDeliveryTokenFormat("has+plus/slash=chars")).toBe(false);

    const { token } = generateDeliveryToken();
    expect(isValidDeliveryTokenFormat(token)).toBe(true);
  });

  it("compares hashed values in constant time", () => {
    const { tokenHash } = generateDeliveryToken();
    const otherHash = hashDeliveryToken("different-token-value");

    expect(tokensMatchConstantTime(tokenHash, tokenHash)).toBe(true);
    expect(tokensMatchConstantTime(tokenHash, otherHash)).toBe(false);
  });

  it("builds public URLs without internal ids", () => {
    const { token } = generateDeliveryToken();
    const url = buildPublicInvoiceUrl(token);

    expect(url).toContain(`/i/${encodeURIComponent(token)}`);
    expect(url).not.toMatch(UUID_PATTERN);
    expect(url).not.toContain("invoice_id");
    expect(url).not.toContain("business_profile_id");
  });
});
