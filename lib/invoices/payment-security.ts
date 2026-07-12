import { roundMoney } from "./calculations";

const MAX_PAYMENT_DECIMALS = 2;
const MAX_PAYMENT_AMOUNT = 99_999_999.99;

export type PaymentAmountValidation =
  | { ok: true; amount: number }
  | { ok: false; error: string };

export type PaymentBalanceValidation =
  | { ok: true; remainingBalance: number }
  | { ok: false; error: string };

function hasExcessivePrecision(value: number): boolean {
  const scaled = value * 10 ** MAX_PAYMENT_DECIMALS;
  return Math.abs(scaled - Math.round(scaled)) > 1e-9;
}

/**
 * Validates a payment amount before recording.
 * Rejects zero, negative, NaN, Infinity, and excessive precision.
 */
export function validatePaymentAmount(amount: unknown): PaymentAmountValidation {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { ok: false, error: "Enter a valid payment amount." };
  }

  if (amount <= 0) {
    return { ok: false, error: "Payment amount must be greater than zero." };
  }

  if (hasExcessivePrecision(amount)) {
    return { ok: false, error: "Payment amount cannot have more than two decimal places." };
  }

  const normalized = roundMoney(amount);

  if (normalized > MAX_PAYMENT_AMOUNT) {
    return { ok: false, error: "Payment amount is too large." };
  }

  return { ok: true, amount: normalized };
}

/**
 * Ensures a payment does not exceed the invoice remaining balance.
 * Uses server-derived totals; does not trust client-supplied balance.
 */
export function validatePaymentAgainstBalance(
  amount: number,
  totalAmount: number,
  amountPaid: number,
): PaymentBalanceValidation {
  const total = roundMoney(totalAmount);
  const paid = roundMoney(amountPaid);
  const remaining = roundMoney(Math.max(0, total - paid));

  if (remaining <= 0) {
    return { ok: false, error: "This invoice has no remaining balance." };
  }

  if (roundMoney(amount) > remaining) {
    return {
      ok: false,
      error: "Payment exceeds the remaining balance.",
    };
  }

  return { ok: true, remainingBalance: remaining };
}

export function sumRecordedPayments(
  payments: Array<{ amount: number }>,
): number {
  return roundMoney(
    payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
  );
}
