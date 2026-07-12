import "server-only";

import { loadBusinessSettings } from "@/lib/business-settings/service";
import {
  buildInvoiceEmailContent,
  buildInvoiceEmailSubject,
} from "@/lib/email/invoice-email-template";
import { sendDevEmail } from "@/lib/email/dev-transport";
import { createClient } from "@/lib/supabase/server";
import { getInvoiceById, updateInvoiceStatus } from "./service";
import {
  buildInvoiceSendPreview,
  mapDeliverySummary,
  normalizeDeliveryMessage,
  sanitizePublicInvoicePayload,
} from "./delivery-validation";
import { generateDeliveryToken } from "./delivery-token";
import { buildPublicInvoiceUrl } from "./delivery-url";
import type {
  InvoiceDeliverySummary,
  InvoiceSendPreview,
  PublicInvoiceView,
} from "./delivery-types";
import type { InvoiceWithDetails } from "./types";
import {
  notifyInvoiceDeliveryFailed,
  notifyInvoiceOpened,
} from "@/lib/notifications/invoice-events";

const DELIVERY_TTL_DAYS = 90;

function deliveryExpiresAt(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + DELIVERY_TTL_DAYS);
  return expires.toISOString();
}

export async function getInvoiceDeliverySummary(
  businessProfileId: string,
  invoiceId: string,
): Promise<InvoiceDeliverySummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoice_deliveries")
    .select(
      "delivery_status, recipient_email, sent_at, opened_at, delivered_at, failed_at, last_error",
    )
    .eq("invoice_id", invoiceId)
    .eq("business_profile_id", businessProfileId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mapDeliverySummary(data);
}

export async function getInvoiceSendPreview(
  businessProfileId: string,
  invoiceId: string,
): Promise<InvoiceSendPreview | null> {
  const invoice = await getInvoiceById(businessProfileId, invoiceId);
  if (!invoice) {
    return null;
  }

  return buildInvoiceSendPreview(invoice);
}

async function revokeActiveDeliveries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  businessProfileId: string,
) {
  const { error } = await supabase
    .from("invoice_deliveries")
    .update({ revoked_at: new Date().toISOString() })
    .eq("invoice_id", invoiceId)
    .eq("business_profile_id", businessProfileId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

async function logInvoiceEmailCommunication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    businessProfileId: string;
    customerId: string;
    invoice: InvoiceWithDetails;
    recipientEmail: string;
    subject: string;
    bodyText: string;
    publicUrl: string;
    deliveryId: string;
  },
) {
  const { data: communication, error: communicationError } = await supabase
    .from("customer_communications")
    .insert({
      customer_id: input.customerId,
      business_profile_id: input.businessProfileId,
      channel: "email",
      title: input.subject,
      occurred_at: new Date().toISOString(),
      metadata: {
        invoice_id: input.invoice.id,
        invoice_number: input.invoice.invoice_number,
        delivery_id: input.deliveryId,
        public_url: input.publicUrl,
        kind: "invoice_delivery",
      },
    })
    .select("id")
    .single();

  if (communicationError || !communication) {
    throw new Error(communicationError?.message ?? "Failed to log communication.");
  }

  const settings = await loadBusinessSettings();
  const fromAddress =
    settings.profile.email.trim() || "no-reply@pluto.local";

  const { error: emailError } = await supabase
    .from("customer_communication_emails")
    .insert({
      communication_id: communication.id,
      direction: "outbound",
      subject: input.subject,
      from_address: fromAddress,
      to_addresses: [input.recipientEmail],
      cc_addresses: [],
      body_html: null,
      body_preview: input.bodyText.slice(0, 500),
      provider: "manual",
      sync_status: "local",
      sent_at: new Date().toISOString(),
    });

  if (emailError) {
    throw new Error(emailError.message);
  }
}

export async function sendInvoiceDelivery(
  businessProfileId: string,
  invoiceId: string,
  optionalMessage?: string | null,
): Promise<{ ok: true; delivery: InvoiceDeliverySummary } | { ok: false; error: string }> {
  const invoice = await getInvoiceById(businessProfileId, invoiceId);
  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }

  const preview = buildInvoiceSendPreview(invoice);
  if (!preview.can_send) {
    return { ok: false, error: preview.block_reason ?? "Invoice cannot be sent." };
  }

  const settings = await loadBusinessSettings();
  const businessName = settings.profile.businessName.trim() || "Your business";
  const fromEmail =
    settings.profile.email.trim() || "no-reply@pluto.local";

  const message = normalizeDeliveryMessage(
    optionalMessage ?? preview.default_message,
  );

  const { token, tokenHash } = generateDeliveryToken();
  const publicUrl = buildPublicInvoiceUrl(token);
  const supabase = await createClient();

  await revokeActiveDeliveries(supabase, invoiceId, businessProfileId);

  const { data: delivery, error: insertError } = await supabase
    .from("invoice_deliveries")
    .insert({
      invoice_id: invoiceId,
      business_profile_id: businessProfileId,
      token_hash: tokenHash,
      delivery_status: "sent",
      recipient_email: preview.recipient_email,
      message,
      sent_at: new Date().toISOString(),
      expires_at: deliveryExpiresAt(),
    })
    .select("id")
    .single();

  if (insertError || !delivery) {
    return { ok: false, error: insertError?.message ?? "Failed to create delivery." };
  }

  const emailContent = buildInvoiceEmailContent({
    preview,
    businessName,
    publicUrl,
    message,
  });

  const emailResult = await sendDevEmail({
    to: preview.recipient_email,
    from: fromEmail,
    subject: buildInvoiceEmailSubject(preview),
    html: emailContent.html,
    text: emailContent.text,
  });

  if (!emailResult.ok) {
    await supabase
      .from("invoice_deliveries")
      .update({
        delivery_status: "failed",
        failed_at: new Date().toISOString(),
        last_error: emailResult.error,
      })
      .eq("id", delivery.id);

    await notifyInvoiceDeliveryFailed(businessProfileId, invoice, emailResult.error);
    return { ok: false, error: emailResult.error };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("invoice_deliveries")
    .update({
      delivery_status: "delivered",
      delivered_at: now,
    })
    .eq("id", delivery.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (invoice.status === "draft") {
    await updateInvoiceStatus(businessProfileId, invoiceId, "sent");
  }

  await logInvoiceEmailCommunication(supabase, {
    businessProfileId,
    customerId: invoice.customer_id,
    invoice,
    recipientEmail: preview.recipient_email,
    subject: buildInvoiceEmailSubject(preview),
    bodyText: emailContent.text,
    publicUrl,
    deliveryId: delivery.id,
  });

  return {
    ok: true,
    delivery: {
      status: "delivered",
      recipient_email: preview.recipient_email,
      sent_at: now,
      opened_at: null,
      delivered_at: now,
      failed_at: null,
      last_error: null,
    },
  };
}

export async function fetchPublicInvoiceByToken(
  token: string,
): Promise<PublicInvoiceView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_invoice_by_token", {
    p_token: token,
  });

  if (error) {
    return null;
  }

  return sanitizePublicInvoicePayload(data as Record<string, unknown> | null);
}

export async function recordPublicInvoiceOpen(
  token: string,
): Promise<{ firstOpen: boolean; invoiceId?: string; businessProfileId?: string; invoiceNumber?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_invoice_delivery_opened", {
    p_token: token,
  });

  if (error || !data || typeof data !== "object") {
    return { firstOpen: false };
  }

  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    return { firstOpen: false };
  }

  const firstOpen = result.first_open === true;

  if (firstOpen && result.business_profile_id && result.invoice_id) {
    await notifyInvoiceOpened(
      String(result.business_profile_id),
      String(result.invoice_id),
      String(result.invoice_number ?? "Invoice"),
    );
  }

  return {
    firstOpen,
    invoiceId: result.invoice_id ? String(result.invoice_id) : undefined,
    businessProfileId: result.business_profile_id
      ? String(result.business_profile_id)
      : undefined,
    invoiceNumber: result.invoice_number ? String(result.invoice_number) : undefined,
  };
}
