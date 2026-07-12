import { describe, expect, it } from "vitest";
import { canVoidInvoice } from "@/lib/invoices/void-security";

const BLOCKED =
  "This invoice cannot be voided because payments have been recorded. Pluto does not yet support payment reversals or refunds — resolve payments before voiding.";

describe("canVoidInvoice (F-010)", () => {
  it("allows voiding unpaid draft invoice", () => {
    expect(
      canVoidInvoice({ status: "draft", amount_paid: 0, payment_count: 0 }),
    ).toEqual({ ok: true });
  });

  it("allows voiding unpaid sent invoice", () => {
    expect(
      canVoidInvoice({ status: "sent", amount_paid: 0, payment_count: 0 }),
    ).toEqual({ ok: true });
  });

  it("blocks voiding partially paid invoice", () => {
    expect(
      canVoidInvoice({
        status: "partially_paid",
        amount_paid: 25,
        payment_count: 1,
      }),
    ).toEqual({ ok: false, error: BLOCKED });
  });

  it("blocks voiding paid invoice", () => {
    expect(
      canVoidInvoice({ status: "paid", amount_paid: 100, payment_count: 1 }),
    ).toEqual({ ok: false, error: BLOCKED });
  });

  it("blocks voiding when amount_paid > 0 even if status is sent", () => {
    expect(
      canVoidInvoice({ status: "sent", amount_paid: 0.01, payment_count: 0 }),
    ).toEqual({ ok: false, error: BLOCKED });
  });

  it("blocks voiding when payment rows exist", () => {
    expect(
      canVoidInvoice({ status: "sent", amount_paid: 0, payment_count: 1 }),
    ).toEqual({ ok: false, error: BLOCKED });
  });

  it("blocks re-voiding", () => {
    expect(
      canVoidInvoice({ status: "void", amount_paid: 0, payment_count: 0 }),
    ).toEqual({ ok: false, error: "Invoice is already void." });
  });
});
