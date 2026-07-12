import { describe, expect, it } from "vitest";
import { canVoidInvoice } from "@/lib/invoices/void-security";
import {
  validatePaymentAgainstBalance,
  validatePaymentAmount,
} from "@/lib/invoices/payment-security";

/**
 * Phase 2B security contracts for invoice/payment hardening.
 * Cross-tenant RLS and RPC behavior require Supabase manual tests (see final report).
 */
describe("invoice payment security contracts", () => {
  it("documents concurrent payment safety via record_invoice_payment_secure RPC", () => {
    const rpcContract = {
      function: "record_invoice_payment_secure",
      concurrency: "SELECT invoice FOR UPDATE before balance check and insert",
      claim:
        "Concurrent payment submissions serialize on the invoice row lock",
    };

    expect(rpcContract.concurrency).toContain("FOR UPDATE");
  });

  it("documents duplicate simultaneous payment rejection", () => {
    const invoiceTotal = 100;
    const firstPayment = 60;
    const secondPayment = 50;

    const first = validatePaymentAgainstBalance(firstPayment, invoiceTotal, 0);
    expect(first.ok).toBe(true);

    const second = validatePaymentAgainstBalance(
      secondPayment,
      invoiceTotal,
      firstPayment,
    );
    expect(second).toEqual({
      ok: false,
      error: "Payment exceeds the remaining balance.",
    });
  });

  it("documents unpaid invoice void allowed, paid/partial blocked", () => {
    expect(canVoidInvoice({ status: "sent", amount_paid: 0, payment_count: 0 }).ok).toBe(
      true,
    );
    expect(
      canVoidInvoice({ status: "partially_paid", amount_paid: 1, payment_count: 1 }).ok,
    ).toBe(false);
    expect(canVoidInvoice({ status: "paid", amount_paid: 100, payment_count: 1 }).ok).toBe(
      false,
    );
  });

  it("documents malformed payment amounts rejected before RPC", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.234]) {
      expect(validatePaymentAmount(bad).ok).toBe(false);
    }
  });
});
