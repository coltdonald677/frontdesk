import "server-only";

import sanitizeHtml from "sanitize-html";
import { stripHtml } from "@/lib/communications/format";
import {
  COMMUNICATION_BODY_MAX_PLAIN_LENGTH,
  COMMUNICATION_HTML_ALLOWED_ATTR,
  COMMUNICATION_HTML_ALLOWED_SCHEMES,
  COMMUNICATION_HTML_ALLOWED_TAGS,
} from "./html-allowlist";

export type SanitizeCommunicationHtmlResult =
  | { ok: true; html: string; plainText: string }
  | { ok: false; error: string };

function sanitizeCore(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...COMMUNICATION_HTML_ALLOWED_TAGS],
    allowedAttributes: COMMUNICATION_HTML_ALLOWED_ATTR,
    allowedSchemes: [...COMMUNICATION_HTML_ALLOWED_SCHEMES],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  }).trim();
}

/**
 * Sanitize rich-text HTML before storing or returning from server actions.
 * Strips scripts, event handlers, javascript: URLs, iframes, SVG, forms, and unsafe styles.
 */
export function sanitizeCommunicationHtml(
  rawHtml: string,
): SanitizeCommunicationHtmlResult {
  const trimmed = rawHtml.trim();
  if (!trimmed) {
    return { ok: false, error: "Content is required." };
  }

  const html = sanitizeCore(trimmed);
  const plainText = stripHtml(html);

  if (!plainText) {
    return { ok: false, error: "Content is required." };
  }

  if (plainText.length > COMMUNICATION_BODY_MAX_PLAIN_LENGTH) {
    return {
      ok: false,
      error: `Content must be ${COMMUNICATION_BODY_MAX_PLAIN_LENGTH.toLocaleString()} characters or fewer.`,
    };
  }

  return { ok: true, html, plainText };
}

/** Defense-in-depth when loading stored HTML (including legacy unsafe rows). */
export function sanitizeCommunicationHtmlForDisplay(rawHtml: string): string {
  if (!rawHtml.trim()) {
    return "";
  }
  return sanitizeCore(rawHtml);
}
