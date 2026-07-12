import { describe, expect, it } from "vitest";
import {
  authorizeInvoiceEdit,
  canRenderInvoiceEditForm,
} from "@/lib/invoices/edit-authorization";

describe("authorizeInvoiceEdit", () => {
  it("allows draft edits", () => {
    expect(authorizeInvoiceEdit("draft")).toEqual({
      allowed: true,
      mode: "draft",
    });
  });

  it("allows closed override for paid invoices", () => {
    expect(authorizeInvoiceEdit("paid")).toEqual({
      allowed: true,
      mode: "closed_override",
    });
  });

  it("rejects sent invoice edits", () => {
    const result = authorizeInvoiceEdit("sent");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toContain("Only draft invoices");
    }
  });

  it("rejects overdue invoice edits", () => {
    expect(authorizeInvoiceEdit("overdue").allowed).toBe(false);
  });
});

describe("canRenderInvoiceEditForm", () => {
  it("renders edit form for draft with edit=1", () => {
    expect(canRenderInvoiceEditForm("draft", "1")).toBe(true);
  });

  it("does not render edit form for sent with edit=1", () => {
    expect(canRenderInvoiceEditForm("sent", "1")).toBe(false);
  });

  it("renders edit form for paid with edit=1", () => {
    expect(canRenderInvoiceEditForm("paid", "1")).toBe(true);
  });
});
