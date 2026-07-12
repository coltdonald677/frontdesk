import { describe, expect, it } from "vitest";
import { authorizeInvoiceEdit } from "@/lib/invoices/edit-authorization";

describe("invoice force_edit removal", () => {
  it("does not grant edit authorization for tampered non-draft statuses", () => {
    for (const status of ["sent", "viewed", "overdue", "partially_paid"] as const) {
      const auth = authorizeInvoiceEdit(status);
      expect(auth.allowed).toBe(false);
    }
  });

  it("still allows normal draft authorization regardless of client flags", () => {
    const auth = authorizeInvoiceEdit("draft");
    expect(auth).toEqual({ allowed: true, mode: "draft" });
  });
});
