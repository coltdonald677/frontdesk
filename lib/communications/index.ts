export {
  getCustomerCommunications,
  getCustomerCommunicationsForTimeline,
  getCommunicationAttachmentsForTimeline,
  getAttachmentSignedUrl,
} from "./communications";
export {
  stripHtml,
  truncateText,
  formatDuration,
  formatFileSize,
  inferAttachmentCategory,
  toDatetimeLocalValue,
  parseDatetimeLocalValue,
} from "./format";
export type {
  AttachmentCategory,
  CommunicationAttachment,
  CommunicationCall,
  CommunicationChannel,
  CommunicationEmail,
  CommunicationNote,
  CustomerCommunication,
  CustomerCommunicationsHub,
  EmailDirection,
  EmailProvider,
  EmailSyncStatus,
  PhoneCallOutcome,
} from "./types";
export {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_CATEGORY_LABELS,
  CHANNEL_LABELS,
  COMMUNICATION_CHANNELS,
  DIRECTION_LABELS,
  EMAIL_DIRECTIONS,
  EMAIL_PROVIDERS,
  EMAIL_SYNC_STATUSES,
  OUTCOME_LABELS,
  PHONE_CALL_OUTCOMES,
  PROVIDER_LABELS,
  SYNC_STATUS_LABELS,
} from "./types";
