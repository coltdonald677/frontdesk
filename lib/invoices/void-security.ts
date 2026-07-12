import type { InvoiceStatus } from "./types";

export type VoidInvoiceValidation =
  | { ok: true }
  | { ok: false; error: string };

const VOID_BLOCKED_MESSAGE =
  "This invoice cannot be voided because payments have been recorded. Pluto does not yet support payment reversals or refunds — resolve payments before voiding.";

/**
 * Invoices with any recorded payment amount or payment rows cannot be voided.
 * Refund/reversal workflow is not implemented.
 */
export function canVoidInvoice(input: {
  status: InvoiceStatus;
  amount_paid: number;
  payment_count?: number;
}): VoidInvoiceValidation {
  if (input.status === "void") {
    return { ok: false, error: "Invoice is already void." };
  }

  if (input.status === "paid") {
    return { ok: false, error: VOID_BLOCKED_MESSAGE };
  }

  if (Number(input.amount_paid) > 0) {
    return { ok: false, error: VOID_BLOCKED_MESSAGE };
  }

  if ((input.payment_count ?? 0) > 0) {
    return { ok: false, error: VOID_BLOCKED_MESSAGE };
  }

  return { ok: true };
}
