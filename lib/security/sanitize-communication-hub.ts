import "server-only";

import type { CustomerCommunication } from "@/lib/communications/types";
import { sanitizeCommunicationHtmlForDisplay } from "./sanitize-communication-html";

/** Sanitize stored HTML on communication records before sending to the client. */
export function sanitizeCommunicationRecord(
  communication: CustomerCommunication,
): CustomerCommunication {
  const note = communication.note
    ? {
        ...communication.note,
        body_html: sanitizeCommunicationHtmlForDisplay(communication.note.body_html),
        body_text: communication.note.body_text,
      }
    : null;

  const email = communication.email
    ? {
        ...communication.email,
        body_html: communication.email.body_html
          ? sanitizeCommunicationHtmlForDisplay(communication.email.body_html)
          : null,
      }
    : null;

  return {
    ...communication,
    note,
    email,
  };
}
