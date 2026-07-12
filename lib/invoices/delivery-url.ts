import "server-only";

const DEFAULT_APP_URL = "http://localhost:3000";

export function getAppBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!configured) {
    return DEFAULT_APP_URL;
  }

  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }

  return `https://${configured.replace(/\/$/, "")}`;
}

export function buildPublicInvoiceUrl(token: string): string {
  return `${getAppBaseUrl()}/i/${encodeURIComponent(token)}`;
}
