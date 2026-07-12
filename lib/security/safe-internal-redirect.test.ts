import { describe, expect, it } from "vitest";
import { safeInternalRedirectPath } from "@/lib/security/safe-internal-redirect";

describe("safeInternalRedirectPath", () => {
  it("allows /dashboard", () => {
    expect(safeInternalRedirectPath("/dashboard")).toBe("/dashboard");
  });

  it("allows nested internal paths", () => {
    expect(safeInternalRedirectPath("/dashboard/customers")).toBe(
      "/dashboard/customers",
    );
  });

  it("rejects absolute https URLs", () => {
    expect(safeInternalRedirectPath("https://evil.example")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeInternalRedirectPath("//evil.example")).toBe("/dashboard");
  });

  it("rejects javascript: URLs", () => {
    expect(safeInternalRedirectPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects encoded external redirect attempts", () => {
    expect(safeInternalRedirectPath("%2F%2Fevil.example")).toBe("/dashboard");
  });

  it("rejects backslash bypasses", () => {
    expect(safeInternalRedirectPath("/\\evil.example")).toBe("/dashboard");
  });

  it("defaults null to /dashboard", () => {
    expect(safeInternalRedirectPath(null)).toBe("/dashboard");
  });
});
