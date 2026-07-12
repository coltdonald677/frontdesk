import { describe, expect, it } from "vitest";
import {
  buildInvoiceSendPreview,
  mapDeliverySummary,
  publicInvoiceContainsSensitiveFields,
  sanitizePublicInvoicePayload,
} from "@/lib/invoices/delivery-validation";
import type { InvoiceWithDetails } from "@/lib/invoices/types";

const BASE_INVOICE: InvoiceWithDetails = {
  id: "11111111-1111-1111-1111-111111111111",
  business_profile_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  customer_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  appointment_id: null,
  invoice_number: "INV-1001",
  status: "draft",
  issue_date: "2026-07-01",
  due_date: "2026-07-15",
  subtotal: 100,
  discount_amount: 0,
  tax_amount: 10,
  total_amount: 110,
  amount_paid: 0,
  balance_due: 110,
  notes: "Internal only",
  customer_message: "Thanks for your business",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  customers: {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    name: "Acme Corp",
    company: "Acme Corp",
    email: "billing@acme.example",
    phone: null,
  },
  line_items: [
    {
      id: "line-1",
      invoice_id: "11111111-1111-1111-1111-111111111111",
      description: "Service",
      quantity: 1,
      unit_price: 100,
      tax_rate: 10,
      line_total: 110,
      sort_order: 0,
      created_at: "2026-07-01T00:00:00.000Z",
    },
  ],
  payments: [],
};

describe("invoice send preview ownership and validation", () => {
  it("uses customer email from invoice records, not caller input", () => {
    const preview = buildInvoiceSendPreview(BASE_INVOICE);

    expect(preview.recipient_email).toBe("billing@acme.example");
    expect(preview.can_send).toBe(true);
    expect(preview).not.toHaveProperty("browser_email");
  });

  it("blocks void invoices from being sent", () => {
    const preview = buildInvoiceSendPreview({
      ...BASE_INVOICE,
      status: "void",
    });

    expect(preview.can_send).toBe(false);
    expect(preview.block_reason).toMatch(/void/i);
  });

  it("blocks send when customer has no email on file", () => {
    const preview = buildInvoiceSendPreview({
      ...BASE_INVOICE,
      customers: {
        ...BASE_INVOICE.customers!,
        email: null,
      },
    });

    expect(preview.can_send).toBe(false);
    expect(preview.block_reason).toMatch(/email/i);
  });

  it("defaults delivery summary to not_sent when no row exists", () => {
    expect(mapDeliverySummary(null)).toEqual({
      status: "not_sent",
      recipient_email: null,
      sent_at: null,
      opened_at: null,
      delivered_at: null,
      failed_at: null,
      last_error: null,
    });
  });
});

describe("public invoice payload sanitization", () => {
  const publicPayload = {
    invoice_number: "INV-1001",
    issue_date: "2026-07-01",
    due_date: "2026-07-15",
    financial_status: "sent",
    subtotal: 100,
    discount_amount: 0,
    tax_amount: 10,
    total_amount: 110,
    amount_paid: 0,
    balance_due: 110,
    customer_message: "Thanks",
    business_name: "Pluto Services",
    business_address: "1 Main St",
    business_phone: "555-0100",
    business_email: "hello@pluto.example",
    customer_name: "Acme Corp",
    line_items: [
      {
        description: "Service",
        quantity: 1,
        unit_price: 100,
        tax_rate: 10,
        line_total: 110,
      },
    ],
  };

  it("returns a safe public view without internal identifiers", () => {
    const view = sanitizePublicInvoicePayload(publicPayload);

    expect(view).not.toBeNull();
    expect(view?.invoice_number).toBe("INV-1001");
    expect(view).not.toHaveProperty("id");
    expect(view).not.toHaveProperty("notes");
    expect(view).not.toHaveProperty("customer_id");
    expect(view).not.toHaveProperty("payments");
  });

  it("rejects payloads that still contain sensitive fields", () => {
    expect(
      publicInvoiceContainsSensitiveFields({
        ...publicPayload,
        notes: "secret",
      }),
    ).toBe(true);

    expect(
      publicInvoiceContainsSensitiveFields({
        ...publicPayload,
        token_hash: "abc",
      }),
    ).toBe(true);

    expect(publicInvoiceContainsSensitiveFields(publicPayload)).toBe(false);
  });

  it("returns null for invalid, expired, or revoked token responses", () => {
    expect(sanitizePublicInvoicePayload(null)).toBeNull();
    expect(sanitizePublicInvoicePayload({})).toBeNull();
    expect(sanitizePublicInvoicePayload({ invoice_number: "INV-1" })).toBeNull();
  });
});
