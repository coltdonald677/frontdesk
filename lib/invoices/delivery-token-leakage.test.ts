import { describe, expect, it } from "vitest";
import { buildInvoiceEmailContent } from "@/lib/email/invoice-email-template";
import { hashDeliveryToken } from "@/lib/invoices/delivery-token";
import type { InvoiceSendPreview } from "@/lib/invoices/delivery-types";

const PREVIEW: InvoiceSendPreview = {
  invoice_id: "11111111-1111-1111-1111-111111111111",
  invoice_number: "INV-9001",
  total_amount: 250,
  balance_due: 250,
  due_date: "2026-08-01",
  customer_name: "Acme Corp",
  recipient_email: "billing@acme.example",
  default_message: "Please pay promptly",
  can_send: true,
  block_reason: null,
};

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

describe("invoice delivery token leakage prevention", () => {
  it("never places internal ids in customer email content", () => {
    const token = "public-only-token-with-sufficient-length-abc";
    const tokenHash = hashDeliveryToken(token);
    const publicUrl = `http://localhost:3000/i/${token}`;
    const { html, text } = buildInvoiceEmailContent({
      preview: PREVIEW,
      businessName: "Pluto Services",
      publicUrl,
      message: "Thanks",
    });

    expect(html).toContain(publicUrl);
    expect(text).toContain(publicUrl);
    expect(html).not.toMatch(UUID_PATTERN);
    expect(text).not.toMatch(UUID_PATTERN);
    expect(html).not.toContain(tokenHash);
    expect(text).not.toContain(PREVIEW.invoice_id);
    expect(html).not.toContain("notes");
    expect(text).not.toContain("notes");
  });
});
