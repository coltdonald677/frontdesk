import { createClient } from "@/lib/supabase/server";
import { sanitizeCommunicationRecord } from "@/lib/security/sanitize-communication-hub";
import type {
  CommunicationAttachment,
  CustomerCommunication,
  CustomerCommunicationsHub,
} from "./types";

const COMMUNICATION_SELECT = `
  *,
  employees(full_name, color),
  note:customer_communication_notes(*),
  call:customer_communication_calls(*),
  email:customer_communication_emails(*)
`;

function normalizeCommunication(row: Record<string, unknown>): CustomerCommunication {
  const note = row.note;
  const call = row.call;
  const email = row.email;

  return {
    ...(row as CustomerCommunication),
    note: Array.isArray(note) ? note[0] ?? null : (note as CustomerCommunication["note"]),
    call: Array.isArray(call) ? call[0] ?? null : (call as CustomerCommunication["call"]),
    email: Array.isArray(email) ? email[0] ?? null : (email as CustomerCommunication["email"]),
  };
}

export async function getCustomerCommunications(
  customerId: string,
): Promise<CustomerCommunicationsHub> {
  const supabase = await createClient();

  const [{ data: communications }, { data: attachments }] = await Promise.all([
    supabase
      .from("customer_communications")
      .select(COMMUNICATION_SELECT)
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("customer_communication_attachments")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  const normalized = (communications ?? []).map((row) =>
    sanitizeCommunicationRecord(
      normalizeCommunication(row as Record<string, unknown>),
    ),
  );

  return {
    notes: normalized.filter((item) => item.channel === "note"),
    calls: normalized.filter((item) => item.channel === "phone_call"),
    emails: normalized.filter((item) => item.channel === "email"),
    attachments: (attachments ?? []) as CommunicationAttachment[],
  };
}

export async function getCustomerCommunicationsForTimeline(
  customerId: string,
): Promise<CustomerCommunication[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_communications")
    .select(COMMUNICATION_SELECT)
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    sanitizeCommunicationRecord(
      normalizeCommunication(row as Record<string, unknown>),
    ),
  );
}

export async function getCommunicationAttachmentsForTimeline(
  customerId: string,
): Promise<CommunicationAttachment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_communication_attachments")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CommunicationAttachment[];
}

export async function getAttachmentSignedUrl(storagePath: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("communication-attachments")
    .createSignedUrl(storagePath, 3600);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}
