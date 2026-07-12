import { formatCurrency } from "@/lib/invoices/types";
import type { InvoiceSendPreview } from "@/lib/invoices/delivery-types";

export function buildInvoiceEmailSubject(preview: InvoiceSendPreview): string {
  return `Invoice ${preview.invoice_number} from your service provider`;
}

export function buildInvoiceEmailContent(input: {
  preview: InvoiceSendPreview;
  businessName: string;
  publicUrl: string;
  message: string | null;
}): { html: string; text: string } {
  const { preview, businessName, publicUrl, message } = input;
  const dueLine = preview.due_date
    ? `<p style="margin:0 0 12px;color:#52525b;">Due date: <strong>${preview.due_date}</strong></p>`
    : "";
  const dueText = preview.due_date ? `Due date: ${preview.due_date}` : "";
  const messageBlock = message
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f4f4f5;border-radius:8px;color:#3f3f46;">${escapeHtml(message)}</p>`
    : "";
  const messageText = message ? `\n\nMessage:\n${message}` : "";

  const html = `
    <div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.5;color:#18181b;max-width:560px;">
      <p style="margin:0 0 12px;">Hello ${escapeHtml(preview.customer_name)},</p>
      <p style="margin:0 0 12px;">${escapeHtml(businessName)} sent you invoice <strong>${escapeHtml(preview.invoice_number)}</strong> for <strong>${formatCurrency(preview.total_amount)}</strong>.</p>
      ${dueLine}
      ${messageBlock}
      <p style="margin:24px 0;">
        <a href="${publicUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">View invoice</a>
      </p>
      <p style="margin:0;color:#71717a;font-size:13px;">Or copy this link:<br><a href="${publicUrl}">${publicUrl}</a></p>
    </div>
  `.trim();

  const text = [
    `Hello ${preview.customer_name},`,
    "",
    `${businessName} sent you invoice ${preview.invoice_number} for ${formatCurrency(preview.total_amount)}.`,
    dueText,
    messageText,
    "",
    `View invoice: ${publicUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
