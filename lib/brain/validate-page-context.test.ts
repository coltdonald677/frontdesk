import { beforeEach, describe, expect, it, vi } from "vitest";

const { assertEntityBelongsToBusiness } = vi.hoisted(() => ({
  assertEntityBelongsToBusiness: vi.fn(),
}));

vi.mock("@/lib/brain/permissions", () => ({
  assertEntityBelongsToBusiness,
}));

import { validateBrainPageContext } from "@/lib/brain/validate-page-context";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("validateBrainPageContext", () => {
  beforeEach(() => {
    assertEntityBelongsToBusiness.mockReset();
    assertEntityBelongsToBusiness.mockResolvedValue({ ok: true });
  });

  it("accepts page context when entities belong to the business", async () => {
    const result = await validateBrainPageContext(BUSINESS_A, {
      pageType: "customer_detail",
      customerId: CUSTOMER_A,
    });

    expect(result).toEqual({
      ok: true,
      context: {
        pageType: "customer_detail",
        customerId: CUSTOMER_A,
      },
    });
    expect(assertEntityBelongsToBusiness).toHaveBeenCalledWith(
      BUSINESS_A,
      "customer",
      CUSTOMER_A,
    );
  });

  it("rejects cross-tenant page context", async () => {
    assertEntityBelongsToBusiness.mockResolvedValueOnce({
      ok: false,
      error: "Customer not found in this business.",
    });

    const result = await validateBrainPageContext(BUSINESS_A, {
      pageType: "customer_detail",
      customerId: CUSTOMER_B,
    });

    expect(result).toEqual({
      ok: false,
      error: "Customer not found in this business.",
    });
  });

  it("returns null context for empty hints", async () => {
    const result = await validateBrainPageContext(BUSINESS_A, null);
    expect(result).toEqual({ ok: true, context: null });
    expect(assertEntityBelongsToBusiness).not.toHaveBeenCalled();
  });
});
