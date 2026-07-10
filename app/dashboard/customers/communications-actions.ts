"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  inferAttachmentCategory,
  parseDatetimeLocalValue,
  stripHtml,
} from "@/lib/communications";
import {
  ATTACHMENT_CATEGORIES,
  EMAIL_DIRECTIONS,
  PHONE_CALL_OUTCOMES,
  type AttachmentCategory,
  type EmailDirection,
  type PhoneCallOutcome,
} from "@/lib/communications/types";
import { createClient } from "@/lib/supabase/server";

export type CommunicationActionState = {
  error?: string;
  success?: boolean;
};

const STORAGE_BUCKET = "communication-attachments";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function getBusinessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getBusinessProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return { supabase, profile };
}

async function verifyCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessProfileId: string,
  customerId: string,
) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return Boolean(customer);
}

function revalidateCustomer(customerId: string) {
  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
}

function parseOptionalEmployeeId(formData: FormData) {
  const value = String(formData.get("employee_id") ?? "").trim();
  return value || null;
}

function isPhoneCallOutcome(value: string): value is PhoneCallOutcome {
  return PHONE_CALL_OUTCOMES.includes(value as PhoneCallOutcome);
}

function isEmailDirection(value: string): value is EmailDirection {
  return EMAIL_DIRECTIONS.includes(value as EmailDirection);
}

function isAttachmentCategory(value: string): value is AttachmentCategory {
  return ATTACHMENT_CATEGORIES.includes(value as AttachmentCategory);
}

function parseAddressList(value: string) {
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function createCommunicationNote(
  _prevState: CommunicationActionState,
  formData: FormData,
): Promise<CommunicationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const bodyHtml = String(formData.get("body_html") ?? "").trim();
  const employeeId = parseOptionalEmployeeId(formData);

  if (!customerId) {
    return { error: "Customer not found." };
  }

  if (!bodyHtml) {
    return { error: "Note content is required." };
  }

  if (!(await verifyCustomer(supabase, profile.id, customerId))) {
    return { error: "Customer not found." };
  }

  const { data: communication, error: communicationError } = await supabase
    .from("customer_communications")
    .insert({
      customer_id: customerId,
      business_profile_id: profile.id,
      channel: "note",
      title: title || null,
      employee_id: employeeId,
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (communicationError || !communication) {
    return { error: communicationError?.message ?? "Failed to create note." };
  }

  const { error: noteError } = await supabase
    .from("customer_communication_notes")
    .insert({
      communication_id: communication.id,
      body_html: bodyHtml,
      body_text: stripHtml(bodyHtml),
    });

  if (noteError) {
    return { error: noteError.message };
  }

  revalidateCustomer(customerId);
  return { success: true };
}

export async function createPhoneCallLog(
  _prevState: CommunicationActionState,
  formData: FormData,
): Promise<CommunicationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const occurredAtRaw = String(formData.get("occurred_at") ?? "").trim();
  const employeeId = parseOptionalEmployeeId(formData);
  const durationMinutes = Number(formData.get("duration_minutes") ?? 0);
  const outcome = String(formData.get("outcome") ?? "").trim();
  const followUpRequired = formData.get("follow_up_required") === "on";
  const summary = String(formData.get("summary") ?? "").trim();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  if (!occurredAtRaw) {
    return { error: "Call date and time are required." };
  }

  if (!isPhoneCallOutcome(outcome)) {
    return { error: "Invalid call outcome." };
  }

  if (!(await verifyCustomer(supabase, profile.id, customerId))) {
    return { error: "Customer not found." };
  }

  const durationSeconds = Math.max(0, Math.round(durationMinutes * 60));

  const { data: communication, error: communicationError } = await supabase
    .from("customer_communications")
    .insert({
      customer_id: customerId,
      business_profile_id: profile.id,
      channel: "phone_call",
      title: "Phone call",
      employee_id: employeeId,
      occurred_at: parseDatetimeLocalValue(occurredAtRaw),
    })
    .select("id")
    .single();

  if (communicationError || !communication) {
    return { error: communicationError?.message ?? "Failed to log call." };
  }

  const { error: callError } = await supabase
    .from("customer_communication_calls")
    .insert({
      communication_id: communication.id,
      duration_seconds: durationSeconds,
      outcome,
      follow_up_required: followUpRequired,
      summary: summary || null,
    });

  if (callError) {
    return { error: callError.message };
  }

  revalidateCustomer(customerId);
  return { success: true };
}

export async function createCommunicationEmail(
  _prevState: CommunicationActionState,
  formData: FormData,
): Promise<CommunicationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const fromAddress = String(formData.get("from_address") ?? "").trim();
  const toAddressesRaw = String(formData.get("to_addresses") ?? "").trim();
  const ccAddressesRaw = String(formData.get("cc_addresses") ?? "").trim();
  const bodyHtml = String(formData.get("body_html") ?? "").trim();
  const employeeId = parseOptionalEmployeeId(formData);
  const occurredAtRaw = String(formData.get("occurred_at") ?? "").trim();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  if (!isEmailDirection(direction)) {
    return { error: "Invalid email direction." };
  }

  if (!subject || !fromAddress || !toAddressesRaw) {
    return { error: "Subject, from, and to fields are required." };
  }

  if (!(await verifyCustomer(supabase, profile.id, customerId))) {
    return { error: "Customer not found." };
  }

  const toAddresses = parseAddressList(toAddressesRaw);
  const ccAddresses = parseAddressList(ccAddressesRaw);
  const bodyText = stripHtml(bodyHtml);
  const occurredAt = occurredAtRaw
    ? parseDatetimeLocalValue(occurredAtRaw)
    : new Date().toISOString();

  const { data: communication, error: communicationError } = await supabase
    .from("customer_communications")
    .insert({
      customer_id: customerId,
      business_profile_id: profile.id,
      channel: "email",
      title: subject,
      employee_id: employeeId,
      occurred_at: occurredAt,
    })
    .select("id")
    .single();

  if (communicationError || !communication) {
    return { error: communicationError?.message ?? "Failed to log email." };
  }

  const { error: emailError } = await supabase
    .from("customer_communication_emails")
    .insert({
      communication_id: communication.id,
      direction,
      subject,
      from_address: fromAddress,
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      body_html: bodyHtml || null,
      body_preview: bodyText.slice(0, 500),
      provider: "manual",
      sync_status: "local",
      sent_at: direction === "outbound" ? occurredAt : null,
      received_at: direction === "inbound" ? occurredAt : null,
    });

  if (emailError) {
    return { error: emailError.message };
  }

  revalidateCustomer(customerId);
  return { success: true };
}

export async function uploadCommunicationAttachment(
  _prevState: CommunicationActionState,
  formData: FormData,
): Promise<CommunicationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const communicationId = String(formData.get("communication_id") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const file = formData.get("file");

  if (!customerId) {
    return { error: "Customer not found." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "File must be 25 MB or smaller." };
  }

  if (!(await verifyCustomer(supabase, profile.id, customerId))) {
    return { error: "Customer not found." };
  }

  const category = isAttachmentCategory(categoryRaw)
    ? categoryRaw
    : inferAttachmentCategory(file.type);

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const storagePath = `${profile.id}/${customerId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: insertError } = await supabase
    .from("customer_communication_attachments")
    .insert({
      customer_id: customerId,
      business_profile_id: profile.id,
      communication_id: communicationId || null,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      storage_path: storagePath,
      category,
    });

  if (insertError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  revalidateCustomer(customerId);
  return { success: true };
}

export async function getAttachmentDownloadUrlAction(
  attachmentId: string,
): Promise<{ url?: string; error?: string }> {
  const { supabase, profile } = await getBusinessContext();

  const { data: attachment, error } = await supabase
    .from("customer_communication_attachments")
    .select("storage_path, business_profile_id")
    .eq("id", attachmentId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!attachment || attachment.business_profile_id !== profile.id) {
    return { error: "Attachment not found." };
  }

  const { data, error: urlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(attachment.storage_path, 3600);

  if (urlError) {
    return { error: urlError.message };
  }

  return { url: data.signedUrl };
}

export async function getCustomerCommunicationsAction(customerId: string) {
  const { supabase, profile } = await getBusinessContext();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  if (!(await verifyCustomer(supabase, profile.id, customerId))) {
    return { error: "Customer not found." };
  }

  const { getCustomerCommunications } = await import("@/lib/communications");
  const hub = await getCustomerCommunications(customerId);
  return { hub };
}
