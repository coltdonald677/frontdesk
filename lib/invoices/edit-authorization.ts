import type { InvoiceStatus } from "./types";

export type InvoiceEditAuthorization =
  | { allowed: true; mode: "draft" }
  | { allowed: true; mode: "closed_override" }
  | { allowed: false; error: string };

const CLOSED_OVERRIDE_STATUSES: InvoiceStatus[] = ["paid", "void"];

/**
 * Server-side edit authorization. Never reads client override flags.
 */
export function authorizeInvoiceEdit(status: InvoiceStatus): InvoiceEditAuthorization {
  if (status === "draft") {
    return { allowed: true, mode: "draft" };
  }

  if (CLOSED_OVERRIDE_STATUSES.includes(status)) {
    return { allowed: true, mode: "closed_override" };
  }

  return {
    allowed: false,
    error:
      "Only draft invoices can be edited. Sent, viewed, overdue, and partially paid invoices cannot be changed.",
  };
}

export function canRenderInvoiceEditForm(
  status: InvoiceStatus,
  editParam: string | undefined,
): boolean {
  if (editParam !== "1") {
    return false;
  }

  const auth = authorizeInvoiceEdit(status);
  return auth.allowed;
}
