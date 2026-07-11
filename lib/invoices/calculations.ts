import type { InvoiceLineItemInput } from "./types";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateLineSubtotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export function calculateLineTax(
  quantity: number,
  unitPrice: number,
  taxRate: number,
): number {
  const subtotal = quantity * unitPrice;
  return roundMoney(subtotal * (taxRate / 100));
}

export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  taxRate: number,
): number {
  const subtotal = quantity * unitPrice;
  const tax = subtotal * (taxRate / 100);
  return roundMoney(subtotal + tax);
}

export function calculateInvoiceTotals(
  lineItems: InvoiceLineItemInput[],
  discountAmount = 0,
) {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of lineItems) {
    const lineSubtotal = item.quantity * item.unit_price;
    subtotal += lineSubtotal;
    taxAmount += lineSubtotal * (item.tax_rate / 100);
  }

  subtotal = roundMoney(subtotal);
  taxAmount = roundMoney(taxAmount);
  const discount = roundMoney(Math.max(0, discountAmount));
  const totalAmount = roundMoney(Math.max(0, subtotal - discount + taxAmount));

  return {
    subtotal,
    taxAmount,
    discountAmount: discount,
    totalAmount,
  };
}

export function validateLineItems(lineItems: InvoiceLineItemInput[]): string | null {
  if (lineItems.length === 0) {
    return "Add at least one line item.";
  }

  for (const [index, item] of lineItems.entries()) {
    if (!item.description.trim()) {
      return `Line item ${index + 1} needs a description.`;
    }
    if (item.quantity <= 0) {
      return `Line item ${index + 1} quantity must be greater than zero.`;
    }
    if (item.unit_price < 0) {
      return `Line item ${index + 1} rate cannot be negative.`;
    }
    if (item.tax_rate < 0) {
      return `Line item ${index + 1} tax rate cannot be negative.`;
    }
  }

  return null;
}

export function deriveStatusAfterPayment(
  totalAmount: number,
  amountPaid: number,
  currentStatus: string,
): "partially_paid" | "paid" {
  if (amountPaid >= totalAmount) {
    return "paid";
  }
  return "partially_paid";
}

export function canMarkOverdue(
  status: string,
  dueDate: string | null,
  balanceDue: number,
  today: string,
): boolean {
  if (balanceDue <= 0) return false;
  if (!dueDate || dueDate >= today) return false;
  return ["sent", "viewed", "partially_paid", "overdue"].includes(status);
}
