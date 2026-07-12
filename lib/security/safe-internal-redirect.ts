const DEFAULT_INTERNAL_PATH = "/dashboard";

/**
 * Validates a post-auth redirect target. Only same-origin relative paths are allowed.
 */
export function safeInternalRedirectPath(
  raw: string | null | undefined,
  fallback = DEFAULT_INTERNAL_PATH,
): string {
  if (!raw) {
    return fallback;
  }

  let candidate = raw.trim();
  if (!candidate) {
    return fallback;
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  candidate = candidate.trim();

  if (
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/i.test(candidate) ||
    candidate.startsWith("//")
  ) {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  if (candidate.includes("://")) {
    return fallback;
  }

  const lower = candidate.toLowerCase();
  if (lower.startsWith("/\\") || lower.includes("javascript:") || lower.includes("data:")) {
    return fallback;
  }

  if (!/^\/[A-Za-z0-9/_\-.%]*$/.test(candidate)) {
    return fallback;
  }

  return candidate;
}
