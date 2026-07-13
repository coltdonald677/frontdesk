import { describe, expect, it } from "vitest";
import {
  applyPlutoAskError,
  applyPlutoAskSuccess,
  computePlutoAssistantBadge,
  createInitialPlutoAssistantState,
  shouldPersistConversationOnNavigation,
} from "@/lib/brain/pluto-assistant-state";
import type { BrainResponse } from "@/lib/brain/types";

function buildResponse(overrides: Partial<BrainResponse> = {}): BrainResponse {
  return {
    answer: "Answer",
    summary: "Summary",
    supportingFacts: [],
    warnings: [],
    suggestedActions: [],
    confidence: "high",
    dataFreshness: new Date().toISOString(),
    providerId: "development-fallback",
    isFallback: true,
    ...overrides,
  };
}

describe("pluto assistant state", () => {
  it("preserves conversation across navigation when unfinished", () => {
    const state = applyPlutoAskSuccess(createInitialPlutoAssistantState(), buildResponse(), "Help");
    expect(shouldPersistConversationOnNavigation(state)).toBe(true);
  });

  it("keeps pending proposal when navigating", () => {
    const state = applyPlutoAskSuccess(
      createInitialPlutoAssistantState(),
      buildResponse({
        suggestedActions: [
          {
            actionType: "create_task",
            title: "Follow up",
            explanation: "Because",
            riskLevel: "low",
            payload: { title: "Follow up" },
          },
        ],
      }),
    );
    expect(state.response?.suggestedActions).toHaveLength(1);
    expect(shouldPersistConversationOnNavigation(state)).toBe(true);
  });

  it("clears pending clarification when actions are proposed", () => {
    const state = applyPlutoAskSuccess(
      {
        ...createInitialPlutoAssistantState(),
        pendingCreateAppointment: {
          datePhrase: "tomorrow",
          appointmentDate: "2026-07-13",
          timePhrase: "2pm",
          startTime: "14:00",
          endTime: "15:00",
          durationMinutes: 60,
          employeeId: null,
          employeeName: null,
        },
      },
      buildResponse({
        suggestedActions: [
          {
            actionType: "create_appointment",
            title: "Book",
            explanation: "Ready",
            riskLevel: "medium",
            payload: {
              customer_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              appointment_date: "2026-07-13",
              start_time: "14:00",
              end_time: "15:00",
              title: "Appointment",
            },
          },
        ],
      }),
    );
    expect(state.pendingCreateAppointment).toBeNull();
  });

  it("clears clarification state on hard errors", () => {
    const state = applyPlutoAskError(
      {
        ...createInitialPlutoAssistantState(),
        pendingCreateAppointment: {
          datePhrase: "tomorrow",
          appointmentDate: "2026-07-13",
          timePhrase: null,
          startTime: null,
          endTime: null,
          durationMinutes: null,
          employeeId: null,
          employeeName: null,
        },
      },
      "Failed",
    );
    expect(state.pendingCreateAppointment).toBeNull();
    expect(state.error).toBe("Failed");
  });
});

describe("computePlutoAssistantBadge", () => {
  it("shows badge for pending clarification", () => {
    expect(
      computePlutoAssistantBadge({
        pendingCreateAppointment: {
          datePhrase: "tomorrow",
          appointmentDate: null,
          timePhrase: null,
          startTime: null,
          endTime: null,
          durationMinutes: null,
          employeeId: null,
          employeeName: null,
        },
        response: null,
        proposedActionCount: 0,
      }),
    ).toBe(true);
  });

  it("shows badge for proposed actions awaiting confirmation", () => {
    expect(
      computePlutoAssistantBadge({
        pendingCreateAppointment: null,
        response: buildResponse({
          suggestedActions: [
            {
              actionType: "create_task",
              title: "Task",
              explanation: "Because",
              riskLevel: "low",
              payload: { title: "Task" },
            },
          ],
        }),
        proposedActionCount: 0,
      }),
    ).toBe(true);
  });

  it("shows badge when Action Center has pending approvals", () => {
    expect(
      computePlutoAssistantBadge({
        pendingCreateAppointment: null,
        response: null,
        proposedActionCount: 2,
      }),
    ).toBe(true);
  });

  it("hides badge when nothing needs attention", () => {
    expect(
      computePlutoAssistantBadge({
        pendingCreateAppointment: null,
        response: buildResponse(),
        proposedActionCount: 0,
      }),
    ).toBe(false);
  });
});
