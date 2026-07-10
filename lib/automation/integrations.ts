import { dispatchAutomationEvent } from "./engine";
import type { AutomationEvent } from "./types";

/**
 * Future integration adapters (Gmail, Google Calendar, QuickBooks, Stripe)
 * should normalize external payloads into AutomationEvent and call this helper.
 */
export async function dispatchIntegrationAutomationEvent(
  businessProfileId: string,
  source: string,
  event: AutomationEvent,
) {
  return dispatchAutomationEvent(businessProfileId, event);
}

export type IntegrationAdapter = {
  id: string;
  label: string;
  mapPayload: (payload: unknown) => AutomationEvent | null;
};

/** Placeholder registry for future third-party adapters. */
export const INTEGRATION_ADAPTERS: IntegrationAdapter[] = [];
