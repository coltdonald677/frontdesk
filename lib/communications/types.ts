export const COMMUNICATION_CHANNELS = ["note", "phone_call", "email"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const EMAIL_PROVIDERS = ["manual", "gmail", "outlook"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export const EMAIL_DIRECTIONS = ["inbound", "outbound"] as const;
export type EmailDirection = (typeof EMAIL_DIRECTIONS)[number];

export const EMAIL_SYNC_STATUSES = ["local", "pending", "synced", "failed"] as const;
export type EmailSyncStatus = (typeof EMAIL_SYNC_STATUSES)[number];

export const PHONE_CALL_OUTCOMES = [
  "connected",
  "voicemail",
  "no_answer",
  "busy",
  "wrong_number",
  "other",
] as const;
export type PhoneCallOutcome = (typeof PHONE_CALL_OUTCOMES)[number];

export const ATTACHMENT_CATEGORIES = [
  "photo",
  "pdf",
  "invoice",
  "document",
  "other",
] as const;
export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  note: "Note",
  phone_call: "Phone call",
  email: "Email",
};

export const OUTCOME_LABELS: Record<PhoneCallOutcome, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  no_answer: "No answer",
  busy: "Busy",
  wrong_number: "Wrong number",
  other: "Other",
};

export const DIRECTION_LABELS: Record<EmailDirection, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
};

export const PROVIDER_LABELS: Record<EmailProvider, string> = {
  manual: "Manual",
  gmail: "Gmail",
  outlook: "Outlook",
};

export const SYNC_STATUS_LABELS: Record<EmailSyncStatus, string> = {
  local: "Local",
  pending: "Pending sync",
  synced: "Synced",
  failed: "Sync failed",
};

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  photo: "Photo",
  pdf: "PDF",
  invoice: "Invoice",
  document: "Document",
  other: "Other",
};

export type CommunicationNote = {
  communication_id: string;
  body_html: string;
  body_text: string;
};

export type CommunicationCall = {
  communication_id: string;
  duration_seconds: number;
  outcome: PhoneCallOutcome;
  follow_up_required: boolean;
  summary: string | null;
};

export type CommunicationEmail = {
  communication_id: string;
  direction: EmailDirection;
  subject: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  body_html: string | null;
  body_preview: string;
  provider: EmailProvider;
  sync_status: EmailSyncStatus;
  external_message_id: string | null;
  sent_at: string | null;
  received_at: string | null;
};

export type CommunicationAttachment = {
  id: string;
  customer_id: string;
  business_profile_id: string;
  communication_id: string | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  category: AttachmentCategory;
  created_at: string;
};

export type CustomerCommunication = {
  id: string;
  customer_id: string;
  business_profile_id: string;
  channel: CommunicationChannel;
  title: string | null;
  occurred_at: string;
  employee_id: string | null;
  external_id: string | null;
  external_thread_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  employees?: { full_name: string; color: string } | null;
  note?: CommunicationNote | null;
  call?: CommunicationCall | null;
  email?: CommunicationEmail | null;
  attachments?: CommunicationAttachment[];
};

export type CustomerCommunicationsHub = {
  notes: CustomerCommunication[];
  calls: CustomerCommunication[];
  emails: CustomerCommunication[];
  attachments: CommunicationAttachment[];
};
