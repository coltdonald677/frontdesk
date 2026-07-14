import { describe, expect, it } from "vitest";
import {
  applyPlutoAskError,
  applyPlutoAskSuccess,
  computeAskButtonDisabled,
  computeAssistantControlsDisabled,
  computeHydrationSafeAskDisabled,
  computeHydrationSafeControlsDisabled,
  computePlutoAssistantBadge,
  createInitialPlutoAssistantState,
  normalizeAssistantQuestion,
  shouldPersistConversationOnNavigation,
  booleanProp,
  anyTruthy,
  assertBooleanProp,
  computeAskButtonLabel,
  computeHydrationSafeAskBusy,
  toDisabledBoolean,
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
        pendingMultiDayAssignment: null,
        response: null,
        proposedActionCount: 0,
      }),
    ).toBe(true);
  });

  it("shows badge for proposed actions awaiting confirmation", () => {
    expect(
      computePlutoAssistantBadge({
        pendingCreateAppointment: null,
        pendingMultiDayAssignment: null,
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
        pendingMultiDayAssignment: null,
        response: null,
        proposedActionCount: 2,
      }),
    ).toBe(true);
  });

  it("hides badge when nothing needs attention", () => {
    expect(
      computePlutoAssistantBadge({
        pendingCreateAppointment: null,
        pendingMultiDayAssignment: null,
        response: buildResponse(),
        proposedActionCount: 0,
      }),
    ).toBe(false);
  });
});

describe("computeAskButtonDisabled", () => {
  it("matches server and initial client disabled state for empty question", () => {
    const initial = createInitialPlutoAssistantState();
    const disabled = computeAskButtonDisabled(false, initial.question);
    expect(disabled).toBe(true);
    expect(typeof disabled).toBe("boolean");
    expect(computeAskButtonDisabled(false, initial.question)).toBe(disabled);
  });

  it("disables Ask for whitespace-only input", () => {
    expect(computeAskButtonDisabled(false, "   ")).toBe(true);
  });

  it("enables Ask for a valid question", () => {
    expect(computeAskButtonDisabled(false, "What needs my attention today?")).toBe(false);
  });

  it("disables Ask while submitting", () => {
    expect(computeAskButtonDisabled(true, "What needs my attention today?")).toBe(true);
  });

  it("normalizes nullish question values to disabled", () => {
    expect(computeAskButtonDisabled(false, null)).toBe(true);
    expect(computeAskButtonDisabled(false, undefined)).toBe(true);
  });
});

describe("restored assistant state hydration safety", () => {
  it("does not enable Ask when restored state has empty question", () => {
    const restored = createInitialPlutoAssistantState();
    expect(computeAskButtonDisabled(false, normalizeAssistantQuestion(restored.question))).toBe(
      true,
    );
  });

  it("persists pending proposal without changing Ask disabled baseline", () => {
    const restored = applyPlutoAskSuccess(createInitialPlutoAssistantState(), buildResponse(), "Help");
    expect(shouldPersistConversationOnNavigation(restored)).toBe(true);
    expect(computeAskButtonDisabled(false, restored.question)).toBe(false);
  });
});

describe("computeAssistantControlsDisabled", () => {
  it("always returns a boolean", () => {
    expect(computeAssistantControlsDisabled(false)).toBe(false);
    expect(computeAssistantControlsDisabled(true)).toBe(true);
    expect(computeAssistantControlsDisabled(null)).toBe(false);
    expect(computeAssistantControlsDisabled(undefined)).toBe(false);
  });
});

describe("computeHydrationSafeAskDisabled", () => {
  it("ignores restored question before hydration", () => {
    expect(
      computeHydrationSafeAskDisabled({
        isHydrated: false,
        isPending: false,
        question: "Restored question",
      }),
    ).toBe(true);
  });

  it("uses live question after hydration", () => {
    expect(
      computeHydrationSafeAskDisabled({
        isHydrated: true,
        isPending: false,
        question: "Restored question",
      }),
    ).toBe(false);
  });
});

describe("computeAskButtonLabel", () => {
  it("returns Ask when idle", () => {
    expect(computeAskButtonLabel(false)).toBe("Ask");
  });

  it("returns Analyzing when busy after hydration", () => {
    expect(computeAskButtonLabel(true)).toBe("Analyzing…");
  });

  it("hydration gate keeps busy false before hydration even if pending is true", () => {
    expect(
      computeHydrationSafeAskBusy({
        isHydrated: false,
        isPending: true,
        question: "Hello",
      }),
    ).toBe(false);
  });
});

describe("booleanProp helpers", () => {
  it("booleanProp and anyTruthy always return booleans", () => {
    expect(typeof booleanProp(null)).toBe("boolean");
    expect(typeof anyTruthy(null, undefined)).toBe("boolean");
    expect(assertBooleanProp("test", false)).toBe(false);
  });

  it("throws in test mode for null boolean props", () => {
    expect(() => assertBooleanProp("disabled", null)).toThrow();
  });
});

describe("toDisabledBoolean", () => {
  it("coerces logical-or inputs to boolean", () => {
    expect(toDisabledBoolean(null || undefined)).toBe(false);
    expect(toDisabledBoolean(null || true)).toBe(true);
    expect(typeof toDisabledBoolean(null, undefined)).toBe("boolean");
  });
});
