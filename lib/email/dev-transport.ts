import "server-only";

export type DevEmailPayload = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
};

export type DevEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Development email transport: logs the message to stdout.
 * Replace with a production provider (Resend, Postmark, etc.) later.
 */
export async function sendDevEmail(payload: DevEmailPayload): Promise<DevEmailResult> {
  if (!payload.to.trim()) {
    return { ok: false, error: "Recipient email is required." };
  }

  if (!payload.from.trim()) {
    return { ok: false, error: "Sender email is required." };
  }

  const messageId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  console.info("[Pluto dev email]", {
    messageId,
    to: payload.to,
    from: payload.from,
    subject: payload.subject,
    textPreview: payload.text.slice(0, 240),
  });

  return { ok: true, messageId };
}
