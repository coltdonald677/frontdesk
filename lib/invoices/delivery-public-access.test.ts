import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatNotificationDedupeKey } from "@/lib/notifications/dedupe";

const { notifyInvoiceOpened } = vi.hoisted(() => ({
  notifyInvoiceOpened: vi.fn(),
}));

vi.mock("@/lib/notifications/invoice-events", () => ({
  notifyInvoiceOpened,
  notifyInvoiceDeliveryFailed: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  fetchPublicInvoiceByToken,
  recordPublicInvoiceOpen,
} from "@/lib/invoices/delivery-service";

const INVOICE_ID = "11111111-1111-1111-1111-111111111111";
const BUSINESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function mockRpc(results: Record<string, unknown>) {
  const rpc = vi.fn(async (fn: string, args: { p_token: string }) => {
    return { data: results[args.p_token] ?? null, error: null };
  });

  vi.mocked(createClient).mockResolvedValue({
    rpc,
  } as never);

  return rpc;
}

describe("public invoice access by token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for invalid, expired, or revoked tokens from RPC", async () => {
    mockRpc({
      "invalid-token-response": null,
    });

    const result = await fetchPublicInvoiceByToken("invalid-token-response");
    expect(result).toBeNull();
  });

  it("sanitizes a valid RPC payload and strips sensitive fields", async () => {
    mockRpc({
      "valid-token-value-with-sufficient-length-abc": {
        invoice_number: "INV-2001",
        issue_date: "2026-07-01",
        due_date: "2026-07-15",
        financial_status: "sent",
        subtotal: 50,
        discount_amount: 0,
        tax_amount: 5,
        total_amount: 55,
        amount_paid: 0,
        balance_due: 55,
        customer_message: null,
        business_name: "Pluto",
        business_address: "1 Main",
        business_phone: "555",
        business_email: null,
        customer_name: "Customer",
        line_items: [],
      },
    });

    const result = await fetchPublicInvoiceByToken(
      "valid-token-value-with-sufficient-length-abc",
    );

    expect(result?.invoice_number).toBe("INV-2001");
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("notes");
  });

  it("notifies owner only on first open", async () => {
    const token = "first-open-token-with-enough-characters-xyz";

    mockRpc({
      [token]: {
        ok: true,
        first_open: true,
        invoice_id: INVOICE_ID,
        business_profile_id: BUSINESS_ID,
        invoice_number: "INV-3001",
      },
    });

    const first = await recordPublicInvoiceOpen(token);
    expect(first.firstOpen).toBe(true);
    expect(notifyInvoiceOpened).toHaveBeenCalledTimes(1);
    expect(notifyInvoiceOpened).toHaveBeenCalledWith(
      BUSINESS_ID,
      INVOICE_ID,
      "INV-3001",
    );

    mockRpc({
      [token]: {
        ok: true,
        first_open: false,
        invoice_id: INVOICE_ID,
        business_profile_id: BUSINESS_ID,
        invoice_number: "INV-3001",
      },
    });

    const second = await recordPublicInvoiceOpen(token);
    expect(second.firstOpen).toBe(false);
    expect(notifyInvoiceOpened).toHaveBeenCalledTimes(1);
  });

  it("does not notify when token lookup fails", async () => {
    mockRpc({
      "revoked-or-expired-token-value-abcdefg": { ok: false },
    });

    const result = await recordPublicInvoiceOpen(
      "revoked-or-expired-token-value-abcdefg",
    );

    expect(result.firstOpen).toBe(false);
    expect(notifyInvoiceOpened).not.toHaveBeenCalled();
  });
});

describe("invoice delivery notification dedupe keys", () => {
  it("dedupes first-open notifications per invoice", () => {
    expect(
      formatNotificationDedupeKey({
        eventType: "invoice.opened",
        entityKey: `${INVOICE_ID}:opened`,
      }),
    ).toBe(`invoice.opened:${INVOICE_ID}:opened`);
  });

  it("dedupes delivery failure notifications per invoice", () => {
    expect(
      formatNotificationDedupeKey({
        eventType: "invoice.delivery_failed",
        entityKey: `${INVOICE_ID}:delivery_failed`,
      }),
    ).toBe(`invoice.delivery_failed:${INVOICE_ID}:delivery_failed`);
  });
});
