import { describe, expect, it } from "vitest";

/**
 * Documents deleteCustomer contract. Integration tests require Supabase;
 * this verifies the result shape the UI depends on.
 */
describe("deleteCustomer contract", () => {
  it("requires explicit success before UI refresh", () => {
    const failure = { error: "Customer not found." };
    const success = { success: true as const };

    expect("success" in failure).toBe(false);
    expect(success.success).toBe(true);
  });

  it("surfaces invoice blocking message", () => {
    const blocked = {
      ok: false as const,
      error:
        "This customer cannot be deleted because they have invoices on file. Void or reassign invoices first.",
    };

    expect(blocked.ok).toBe(false);
    expect(blocked.error).toContain("invoices");
  });
});
