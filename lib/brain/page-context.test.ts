import { describe, expect, it } from "vitest";
import {
  buildContextualBrainQuestion,
  normalizeBrainPageContextHint,
  parsePageContextFromPathname,
} from "@/lib/brain/page-context";

const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const INVOICE_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const APPOINTMENT_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";

describe("parsePageContextFromPathname", () => {
  it("maps dashboard routes to page types", () => {
    expect(parsePageContextFromPathname("/dashboard")).toEqual({ pageType: "dashboard" });
    expect(parsePageContextFromPathname("/dashboard/schedule")).toEqual({ pageType: "schedule" });
    expect(parsePageContextFromPathname("/dashboard/tasks")).toEqual({ pageType: "tasks" });
    expect(parsePageContextFromPathname("/dashboard/actions")).toEqual({ pageType: "actions" });
    expect(parsePageContextFromPathname("/dashboard/settings/profile")).toEqual({
      pageType: "settings",
    });
  });

  it("extracts detail page entity IDs from path segments", () => {
    expect(parsePageContextFromPathname(`/dashboard/customers/${CUSTOMER_A}`)).toEqual({
      pageType: "customer_detail",
      customerId: CUSTOMER_A,
    });
    expect(parsePageContextFromPathname(`/dashboard/invoices/${INVOICE_A}`)).toEqual({
      pageType: "invoice_detail",
      invoiceId: INVOICE_A,
    });
    expect(parsePageContextFromPathname(`/dashboard/invoices/${INVOICE_A}/print`)).toEqual({
      pageType: "invoices",
    });
  });

  it("reads appointment ID from schedule query params", () => {
    const params = new URLSearchParams({ appointment: APPOINTMENT_A });
    expect(parsePageContextFromPathname("/dashboard/schedule", params)).toEqual({
      pageType: "schedule",
      appointmentId: APPOINTMENT_A,
    });
  });

  it("ignores malformed entity IDs", () => {
    expect(parsePageContextFromPathname("/dashboard/customers/not-a-uuid")).toEqual({
      pageType: "customers",
    });
  });
});

describe("normalizeBrainPageContextHint", () => {
  it("strips invalid UUIDs from hints", () => {
    expect(
      normalizeBrainPageContextHint({
        pageType: "customer_detail",
        customerId: "bad-id",
      }),
    ).toEqual({
      pageType: "customer_detail",
      customerId: undefined,
    });
  });

  it("returns null for empty hints", () => {
    expect(normalizeBrainPageContextHint(null)).toBeNull();
  });
});

describe("buildContextualBrainQuestion", () => {
  it("appends validated page context to the question", () => {
    const question = buildContextualBrainQuestion("Explain this invoice", {
      pageType: "invoice_detail",
      invoiceId: INVOICE_A,
    });
    expect(question).toContain("Explain this invoice");
    expect(question).toContain(`invoice_id=${INVOICE_A}`);
  });

  it("leaves questions unchanged when page type is other", () => {
    expect(buildContextualBrainQuestion("Hello", { pageType: "other" })).toBe("Hello");
  });
});
