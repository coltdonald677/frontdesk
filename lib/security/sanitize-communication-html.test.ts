import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  sanitizeCommunicationHtml,
  sanitizeCommunicationHtmlForDisplay,
} from "@/lib/security/sanitize-communication-html";

describe("sanitizeCommunicationHtml", () => {
  it("strips script tags", () => {
    const result = sanitizeCommunicationHtml("<p>Hi</p><script>alert(1)</script>");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).not.toContain("script");
      expect(result.html).not.toContain("alert");
    }
  });

  it("strips img onerror handlers from mixed content", () => {
    const result = sanitizeCommunicationHtml(
      '<p>Safe note</p><img src=x onerror=alert(1)>',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).not.toContain("onerror");
      expect(result.html).not.toContain("img");
      expect(result.html).toContain("Safe note");
    }
  });

  it("rejects img-only XSS payloads with no text content", () => {
    const result = sanitizeCommunicationHtml('<img src=x onerror=alert(1)>');
    expect(result.ok).toBe(false);
  });

  it("removes javascript: links", () => {
    const result = sanitizeCommunicationHtml(
      '<a href="javascript:alert(1)">Click</a>',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html.toLowerCase()).not.toContain("javascript:");
    }
  });

  it("allows basic formatting", () => {
    const result = sanitizeCommunicationHtml("<p><strong>Bold</strong> text</p>");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toContain("<strong>");
      expect(result.html).toContain("Bold");
    }
  });

  it("rejects empty content after sanitization", () => {
    const result = sanitizeCommunicationHtml("<script>alert(1)</script>");
    expect(result.ok).toBe(false);
  });
});

describe("sanitizeCommunicationHtmlForDisplay", () => {
  it("sanitizes legacy stored XSS payloads", () => {
    const safe = sanitizeCommunicationHtmlForDisplay(
      '<p>Note</p><img src=x onerror=alert(1)>',
    );
    expect(safe).toContain("Note");
    expect(safe).not.toContain("onerror");
    expect(safe).not.toContain("img");
  });

  it("handles malformed nested HTML", () => {
    const safe = sanitizeCommunicationHtmlForDisplay(
      "<div><p>Unclosed<div><script>x</script></p>",
    );
    expect(safe).not.toContain("script");
  });
});
