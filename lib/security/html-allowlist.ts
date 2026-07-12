/** Shared allowlist for communication rich-text (server + client sanitizers). */

export const COMMUNICATION_HTML_ALLOWED_TAGS = [
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "div",
  "span",
] as const;

export const COMMUNICATION_HTML_ALLOWED_ATTR: Record<string, string[]> = {
  a: ["href", "title"],
};

export const COMMUNICATION_HTML_ALLOWED_SCHEMES = ["http", "https", "mailto"] as const;

/** Max plain-text length after HTML is stripped (notes/emails). */
export const COMMUNICATION_BODY_MAX_PLAIN_LENGTH = 50_000;
