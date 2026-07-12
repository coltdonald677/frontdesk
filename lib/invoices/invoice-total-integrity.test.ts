import { describe, expect, it } from "vitest";
import { validateInvoiceTotalUpdate } from "@/lib/invoices/invoice-total-integrity";

describe("invoice total integrity (database trigger contract)", () => {
  it("allows unpaid invoice total to be edited", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "draft",
      newStatus: "draft",
      oldAmountPaid: 0,
      oldTotalAmount: 100,
      oldBalanceDue: 100,
      newAmountPaid: 0,
      newTotalAmount: 80,
      newBalanceDue: 80,
      hasPaymentRows: false,
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects partially paid invoice reduced below amount_paid", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "partially_paid",
      newStatus: "partially_paid",
      oldAmountPaid: 40,
      oldTotalAmount: 100,
      oldBalanceDue: 60,
      newAmountPaid: 40,
      newTotalAmount: 30,
      newBalanceDue: 0,
      hasPaymentRows: true,
    });

    expect(result).toEqual({
      ok: false,
      error: "Invoice total cannot be reduced below amount already paid.",
    });
  });

  it("allows partially paid invoice to be increased safely", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "partially_paid",
      newStatus: "partially_paid",
      oldAmountPaid: 40,
      oldTotalAmount: 100,
      oldBalanceDue: 60,
      newAmountPaid: 40,
      newTotalAmount: 150,
      newBalanceDue: 110,
      hasPaymentRows: true,
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects paid invoice total altered into inconsistent state", () => {
    const reduced = validateInvoiceTotalUpdate({
      oldStatus: "paid",
      newStatus: "paid",
      oldAmountPaid: 100,
      oldTotalAmount: 100,
      oldBalanceDue: 0,
      newAmountPaid: 100,
      newTotalAmount: 80,
      newBalanceDue: 0,
      hasPaymentRows: true,
    });

    expect(reduced).toEqual({
      ok: false,
      error: "Invoice total cannot be reduced below amount already paid.",
    });

    const mismatchedTotals = validateInvoiceTotalUpdate({
      oldStatus: "paid",
      newStatus: "paid",
      oldAmountPaid: 100,
      oldTotalAmount: 100,
      oldBalanceDue: 0,
      newAmountPaid: 100,
      newTotalAmount: 120,
      newBalanceDue: 0,
      hasPaymentRows: true,
    });

    expect(mismatchedTotals).toEqual({
      ok: false,
      error: "Paid invoices must have amount_paid equal to total_amount.",
    });
  });

  it("allows payment RPC to update amount_paid and balance together", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "sent",
      newStatus: "partially_paid",
      oldAmountPaid: 0,
      oldTotalAmount: 100,
      oldBalanceDue: 100,
      newAmountPaid: 40,
      newTotalAmount: 100,
      newBalanceDue: 60,
      hasPaymentRows: false,
      viaPaymentRpc: true,
    });

    expect(result).toEqual({ ok: true });
  });
});

describe("invoice status consistency on financial updates", () => {
  it("rejects paid invoice total increased while status stays paid", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "paid",
      newStatus: "paid",
      oldAmountPaid: 100,
      oldTotalAmount: 100,
      oldBalanceDue: 0,
      newAmountPaid: 100,
      newTotalAmount: 120,
      newBalanceDue: 20,
      hasPaymentRows: true,
    });

    expect(result).toEqual({
      ok: false,
      error: "Paid invoices must have amount_paid equal to total_amount.",
    });
  });

  it("rejects paid invoice with positive balance_due", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "paid",
      newStatus: "paid",
      oldAmountPaid: 100,
      oldTotalAmount: 100,
      oldBalanceDue: 0,
      newAmountPaid: 100,
      newTotalAmount: 100,
      newBalanceDue: 10,
      hasPaymentRows: true,
    });

    expect(result).toEqual({
      ok: false,
      error: "Paid invoices must have zero balance_due.",
    });
  });

  it("rejects partially paid invoice with zero balance_due", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "partially_paid",
      newStatus: "partially_paid",
      oldAmountPaid: 40,
      oldTotalAmount: 100,
      oldBalanceDue: 60,
      newAmountPaid: 40,
      newTotalAmount: 100,
      newBalanceDue: 0,
      hasPaymentRows: true,
    });

    expect(result).toEqual({
      ok: false,
      error: "Partially paid invoices must have balance_due greater than zero.",
    });
  });

  it("rejects partially paid invoice with amount_paid equal to total_amount", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "partially_paid",
      newStatus: "partially_paid",
      oldAmountPaid: 40,
      oldTotalAmount: 100,
      oldBalanceDue: 60,
      newAmountPaid: 40,
      newTotalAmount: 40,
      newBalanceDue: 0,
      hasPaymentRows: true,
    });

    expect(result).toEqual({
      ok: false,
      error: "Invoice cannot remain partially paid when fully settled.",
    });
  });

  it("rejects unpaid invoice manually marked paid or partially_paid", () => {
    const markedPaid = validateInvoiceTotalUpdate({
      oldStatus: "sent",
      newStatus: "paid",
      oldAmountPaid: 0,
      oldTotalAmount: 100,
      oldBalanceDue: 100,
      newAmountPaid: 0,
      newTotalAmount: 100,
      newBalanceDue: 100,
      hasPaymentRows: false,
    });

    expect(markedPaid).toEqual({
      ok: false,
      error: "Invoice cannot be paid or partially paid with zero amount_paid.",
    });

    const markedPartial = validateInvoiceTotalUpdate({
      oldStatus: "sent",
      newStatus: "partially_paid",
      oldAmountPaid: 0,
      oldTotalAmount: 100,
      oldBalanceDue: 100,
      newAmountPaid: 0,
      newTotalAmount: 100,
      newBalanceDue: 100,
      hasPaymentRows: false,
    });

    expect(markedPartial).toEqual({
      ok: false,
      error: "Invoice cannot be paid or partially paid with zero amount_paid.",
    });
  });

  it("allows valid unpaid invoice edit", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "draft",
      newStatus: "draft",
      oldAmountPaid: 0,
      oldTotalAmount: 100,
      oldBalanceDue: 100,
      newAmountPaid: 0,
      newTotalAmount: 125,
      newBalanceDue: 125,
      hasPaymentRows: false,
    });

    expect(result).toEqual({ ok: true });
  });

  it("allows valid partially paid total increase with recalculated balance", () => {
    const result = validateInvoiceTotalUpdate({
      oldStatus: "partially_paid",
      newStatus: "partially_paid",
      oldAmountPaid: 40,
      oldTotalAmount: 100,
      oldBalanceDue: 60,
      newAmountPaid: 40,
      newTotalAmount: 150,
      newBalanceDue: 110,
      hasPaymentRows: true,
    });

    expect(result).toEqual({ ok: true });
  });
});
