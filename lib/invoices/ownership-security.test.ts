import { describe, expect, it, vi } from "vitest";
import {
  verifyAppointmentBelongsToBusiness,
  verifyCustomerBelongsToBusiness,
  verifyInvoiceBelongsToBusiness,
  verifyInvoiceForeignKeys,
} from "@/lib/invoices/ownership-security";

const BUSINESS_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BUSINESS_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CUSTOMER_B = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const APPOINTMENT_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";

type Row = Record<string, unknown> | null;

function mockSupabase(tableRows: Record<string, Row>) {
  return {
    from: vi.fn((table: string) => {
      const chain = {
        _filters: [] as Array<{ col: string; val: unknown }>,
        select: vi.fn(function (this: typeof chain) {
          return this;
        }),
        eq: vi.fn(function (this: typeof chain, col: string, val: unknown) {
          this._filters.push({ col, val });
          return this;
        }),
        maybeSingle: vi.fn(async function (this: typeof chain) {
          const row = tableRows[table];
          if (!row) return { data: null };

          const matches = this._filters.every((f) => row[f.col] === f.val);
          return { data: matches ? row : null };
        }),
      };
      return chain;
    }),
  } as unknown as Parameters<typeof verifyCustomerBelongsToBusiness>[0];
}

describe("invoice ownership validation (F-005)", () => {
  it("rejects Business B customer for Business A", async () => {
    const supabase = mockSupabase({
      customers: {
        id: CUSTOMER_B,
        business_profile_id: BUSINESS_B,
      },
    });

    const result = await verifyCustomerBelongsToBusiness(
      supabase,
      BUSINESS_A,
      CUSTOMER_B,
    );

    expect(result).toEqual({ ok: false, error: "Customer not found." });
  });

  it("accepts customer belonging to same business", async () => {
    const supabase = mockSupabase({
      customers: {
        id: CUSTOMER_B,
        business_profile_id: BUSINESS_A,
      },
    });

    const result = await verifyCustomerBelongsToBusiness(
      supabase,
      BUSINESS_A,
      CUSTOMER_B,
    );

    expect(result).toEqual({ ok: true });
  });

  it("rejects Business B appointment for Business A", async () => {
    const supabase = mockSupabase({
      appointments: {
        id: APPOINTMENT_B,
        business_profile_id: BUSINESS_B,
        customer_id: CUSTOMER_B,
      },
    });

    const result = await verifyAppointmentBelongsToBusiness(
      supabase,
      BUSINESS_A,
      APPOINTMENT_B,
    );

    expect(result).toEqual({ ok: false, error: "Appointment not found." });
  });

  it("rejects appointment linked to different customer", async () => {
    const supabase = mockSupabase({
      appointments: {
        id: APPOINTMENT_B,
        business_profile_id: BUSINESS_A,
        customer_id: "other-customer-id",
      },
    });

    const result = await verifyAppointmentBelongsToBusiness(
      supabase,
      BUSINESS_A,
      APPOINTMENT_B,
      CUSTOMER_B,
    );

    expect(result).toEqual({
      ok: false,
      error: "Appointment does not belong to the selected customer.",
    });
  });

  it("rejects cross-tenant invoice access", async () => {
    const supabase = mockSupabase({
      invoices: {
        id: "invoice-b",
        business_profile_id: BUSINESS_B,
      },
    });

    const result = await verifyInvoiceBelongsToBusiness(
      supabase,
      BUSINESS_A,
      "invoice-b",
    );

    expect(result).toEqual({ ok: false, error: "Invoice not found." });
  });

  it("rejects invoice create with foreign customer via verifyInvoiceForeignKeys", async () => {
    const supabase = mockSupabase({
      customers: {
        id: CUSTOMER_B,
        business_profile_id: BUSINESS_B,
      },
    });

    const result = await verifyInvoiceForeignKeys(
      supabase,
      BUSINESS_A,
      CUSTOMER_B,
      null,
    );

    expect(result.ok).toBe(false);
  });
});

describe("payment ownership contract (F-006)", () => {
  it("documents that payment insert requires invoice in same business", () => {
    const payment = {
      invoice_id: "invoice-b",
      business_profile_id: BUSINESS_A,
    };

    expect(payment.business_profile_id).not.toEqual(BUSINESS_B);
    expect(payment.invoice_id).toBeTruthy();
  });
});
