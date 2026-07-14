import {
  buildEntityClarificationResult,
  buildNoMatchClarificationResult,
  resolveInvoiceForWriteIntent,
} from "./entity-suggestion-service";
import type { InvoiceLookupRecord } from "./entity-live-lookup";
import type { BrainContextSnapshot, WriteIntentParseOptions, WriteIntentResult } from "./types";

export function isInvoiceLookupIntent(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;
  if (/\b(create|draft)\s+(a\s+)?invoice\b/i.test(trimmed)) return false;
  return (
    /\binvoice\b/i.test(trimmed) ||
    /\bINV[-\s]?\d+/i.test(trimmed) ||
    (/\b(find|show|look up|lookup|which)\b/i.test(trimmed) &&
      /\b(invoice|bill|billing)\b/i.test(trimmed))
  );
}

export function extractInvoiceReference(question: string): string | null {
  const numberMatch = question.match(/\b(INV[-\s]?\d+)\b/i);
  if (numberMatch) return numberMatch[1].trim();

  const forCustomer = question.match(/\binvoice\s+for\s+(.+?)(?:\s*$|\?)/i);
  if (forCustomer) return forCustomer[1].trim();

  const customerInvoice = question.match(/\b(.+?)(?:'s)?\s+invoice\b/i);
  if (customerInvoice) return customerInvoice[1].trim();

  const labeled = question.match(/\binvoice\s+(.+?)(?:\s*$|\?)/i);
  if (labeled && !/^(for|number|status)$/i.test(labeled[1].trim())) {
    return labeled[1].trim();
  }

  return null;
}

export function resolveInvoiceLookupIntent(
  question: string,
  context: BrainContextSnapshot,
  invoices: InvoiceLookupRecord[],
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  const reference = extractInvoiceReference(question);
  if (!reference) {
    return {
      kind: "clarification",
      question: "Which invoice are you looking for? You can give an invoice number or customer name.",
    };
  }

  const parseOpts: WriteIntentParseOptions = {
    ...writeOptions,
    originalQuestion: writeOptions?.originalQuestion ?? question,
    liveInvoiceDirectory: invoices,
  };

  const resolution = resolveInvoiceForWriteIntent(reference, invoices, parseOpts);
  if (resolution.status === "needs_clarification") {
    return resolution.result;
  }

  const invoice = resolution.entity;
  return {
    kind: "clarification",
    question: `I found Invoice ${invoice.number} for ${invoice.customer} (${invoice.status}${invoice.totalAmount > 0 ? `, $${invoice.totalAmount.toFixed(2)}` : ""}). What would you like to do with it?`,
    pendingEntityClarification: undefined,
  };
}

export function resolveInvoiceLookupClarificationOnly(
  question: string,
  invoices: InvoiceLookupRecord[],
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  const reference = extractInvoiceReference(question);
  if (!reference) {
    return buildNoMatchClarificationResult({
      originalQuestion: writeOptions?.originalQuestion ?? question,
      reference: question,
      entityType: "invoice",
      resolvedOverrides: writeOptions?.resolvedEntityOverrides,
    });
  }

  const resolution = resolveInvoiceForWriteIntent(reference, invoices, writeOptions);
  if (resolution.status === "needs_clarification") {
    return resolution.result;
  }

  return buildEntityClarificationResult({
    originalQuestion: writeOptions?.originalQuestion ?? question,
    reference,
    entityType: "invoice",
    suggestions: [],
    pageContext: writeOptions?.pageContext,
  });
}
