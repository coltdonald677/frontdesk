import { describe, expect, it } from "vitest";
import {
  sumRecordedPayments,
  validatePaymentAgainstBalance,
  validatePaymentAmount,
} from "@/lib/invoices/payment-security";

describe("validatePaymentAmount (F-009)", () => {
  it("rejects zero payment", () => {
    expect(validatePaymentAmount(0)).toEqual({
      ok: false,
      error: "Payment amount must be greater than zero.",
    });
  });

  it("rejects negative payment", () => {
    expect(validatePaymentAmount(-10)).toEqual({
      ok: false,
      error: "Payment amount must be greater than zero.",
    });
  });

  it("rejects NaN and Infinity", () => {
    expect(validatePaymentAmount(Number.NaN).ok).toBe(false);
    expect(validatePaymentAmount(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(validatePaymentAmount(Number.NEGATIVE_INFINITY).ok).toBe(false);
  });

  it("rejects excessive decimal precision", () => {
    expect(validatePaymentAmount(10.001).ok).toBe(false);
  });

  it("accepts valid partial payment", () => {
    expect(validatePaymentAmount(25.5)).toEqual({ ok: true, amount: 25.5 });
  });
});

describe("validatePaymentAgainstBalance (F-009)", () => {
  it("rejects overpayment", () => {
    expect(validatePaymentAgainstBalance(150, 100, 0)).toEqual({
      ok: false,
      error: "Payment exceeds the remaining balance.",
    });
  });

  it("accepts exact remaining balance", () => {
    expect(validatePaymentAgainstBalance(40, 100, 60)).toEqual({
      ok: true,
      remainingBalance: 40,
    });
  });

  it("accepts partial payment", () => {
    expect(validatePaymentAgainstBalance(25, 100, 0)).toEqual({
      ok: true,
      remainingBalance: 100,
    });
  });

  it("rejects payment when no balance remains", () => {
    expect(validatePaymentAgainstBalance(1, 100, 100)).toEqual({
      ok: false,
      error: "This invoice has no remaining balance.",
    });
  });

  it("does not trust client-supplied balance — uses server totals", () => {
    const result = validatePaymentAgainstBalance(50, 100, 30);
    expect(result).toEqual({ ok: true, remainingBalance: 70 });
  });
});

describe("sumRecordedPayments", () => {
  it("sums payment rows with cent rounding", () => {
    expect(
      sumRecordedPayments([{ amount: 10.1 }, { amount: 20.205 }]),
    ).toBe(30.31);
  });
});
