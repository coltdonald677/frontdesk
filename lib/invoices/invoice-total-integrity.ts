/**
 * Mirrors database trigger rules in enforce_invoice_financial_update.
 * Used for automated tests; production enforcement is in the migration SQL.
 */
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type InvoiceTotalUpdateInput = {
  oldStatus: InvoiceStatus;
  newStatus: InvoiceStatus;
  oldAmountPaid: number;
  oldTotalAmount: number;
  oldBalanceDue: number;
  newAmountPaid: number;
  newTotalAmount: number;
  newBalanceDue: number;
  hasPaymentRows: boolean;
  viaPaymentRpc?: boolean;
};

export type InvoiceTotalUpdateValidation =
  | { ok: true }
  | { ok: false; error: string };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function totalsAreConsistent(
  amountPaid: number,
  balanceDue: number,
  totalAmount: number,
): boolean {
  return roundMoney(amountPaid + balanceDue) === roundMoney(totalAmount);
}

export function validateInvoiceStatusConsistency(input: {
  status: InvoiceStatus;
  amountPaid: number;
  totalAmount: number;
  balanceDue: number;
  hasPaymentRows: boolean;
}): InvoiceTotalUpdateValidation {
  const { status, amountPaid, totalAmount, balanceDue, hasPaymentRows } = input;
  const paid = roundMoney(amountPaid);
  const total = roundMoney(totalAmount);
  const balance = roundMoney(balanceDue);

  if (paid === 0 && (status === "paid" || status === "partially_paid")) {
    return {
      ok: false,
      error: "Invoice cannot be paid or partially paid with zero amount_paid.",
    };
  }

  if (balance === 0 && paid === total && status === "partially_paid") {
    return {
      ok: false,
      error: "Invoice cannot remain partially paid when fully settled.",
    };
  }

  if (status === "paid") {
    if (paid !== total) {
      return {
        ok: false,
        error: "Paid invoices must have amount_paid equal to total_amount.",
      };
    }

    if (balance !== 0) {
      return {
        ok: false,
        error: "Paid invoices must have zero balance_due.",
      };
    }

    if (!hasPaymentRows && paid <= 0) {
      return {
        ok: false,
        error: "Paid invoices must have recorded payment history.",
      };
    }
  }

  if (status === "partially_paid") {
    if (paid <= 0) {
      return {
        ok: false,
        error: "Partially paid invoices must have amount_paid greater than zero.",
      };
    }

    if (paid >= total) {
      return {
        ok: false,
        error:
          "Partially paid invoices must have amount_paid less than total_amount.",
      };
    }

    if (balance <= 0) {
      return {
        ok: false,
        error: "Partially paid invoices must have balance_due greater than zero.",
      };
    }
  }

  return { ok: true };
}

export function validateInvoiceTotalUpdate(
  input: InvoiceTotalUpdateInput,
): InvoiceTotalUpdateValidation {
  const {
    oldAmountPaid,
    newAmountPaid,
    newTotalAmount,
    newBalanceDue,
    newStatus,
    hasPaymentRows,
    viaPaymentRpc = false,
  } = input;

  if (newBalanceDue < 0) {
    return { ok: false, error: "Invoice balance due cannot be negative." };
  }

  if (viaPaymentRpc) {
    if (!totalsAreConsistent(newAmountPaid, newBalanceDue, newTotalAmount)) {
      return {
        ok: false,
        error: "Invoice amount_paid and balance_due must equal total_amount.",
      };
    }
    return { ok: true };
  }

  if (newAmountPaid !== oldAmountPaid) {
    return {
      ok: false,
      error:
        "Invoice payment totals can only be updated through record_invoice_payment_secure.",
    };
  }

  const hasPayments = oldAmountPaid > 0 || hasPaymentRows;

  if (hasPayments && newTotalAmount < oldAmountPaid) {
    return {
      ok: false,
      error: "Invoice total cannot be reduced below amount already paid.",
    };
  }

  const statusCheck = validateInvoiceStatusConsistency({
    status: newStatus,
    amountPaid: newAmountPaid,
    totalAmount: newTotalAmount,
    balanceDue: newBalanceDue,
    hasPaymentRows,
  });
  if (!statusCheck.ok) {
    return statusCheck;
  }

  if (!totalsAreConsistent(newAmountPaid, newBalanceDue, newTotalAmount)) {
    return {
      ok: false,
      error: "Invoice amount_paid and balance_due must equal total_amount.",
    };
  }

  return { ok: true };
}

export function hasRecordedPayments(input: {
  amountPaid: number;
  paymentCount: number;
}): boolean {
  return input.amountPaid > 0 || input.paymentCount > 0;
}
