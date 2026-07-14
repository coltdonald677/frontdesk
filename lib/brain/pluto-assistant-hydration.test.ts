import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateMultiDayAssignmentProposal } from "@/lib/brain/multi-day-assignment-parser";
import { resolveMultiDayAssignmentIntent } from "@/lib/brain/multi-day-assignment-parser";
import {
  anyTruthy,
  applyPlutoAskSuccess,
  assertBooleanProp,
  booleanProp,
  computeAskButtonDisabled,
  computeAskButtonLabel,
  computeHydrationSafeAskBusy,
  computeHydrationSafeAskDisabled,
  computeHydrationSafeControlsDisabled,
  createHydrationSafeAssistantControls,
  createInitialPlutoAssistantState,
  getHydrationSafeQuestion,
  shouldRenderHydratedAssistantUi,
  toDisabledBoolean,
} from "@/lib/brain/pluto-assistant-state";
import type { BrainContextSnapshot, BrainResponse } from "@/lib/brain/types";

const ASK_PLUTO_FILES = [
  "app/components/brain/pluto-assistant-content.tsx",
  "app/components/brain/pluto-assistant-drawer.tsx",
  "app/components/brain/pluto-assistant-provider.tsx",
  "app/components/brain/pluto-assistant-panel.tsx",
  "app/components/brain/brain-suggested-action-card.tsx",
  "app/components/brain/pluto-brain-section.tsx",
  "app/components/dashboard/top-bar.tsx",
  "app/components/dashboard/dashboard-shell.tsx",
];

const BOOLEAN_ATTRIBUTE_PATTERNS = [
  /disabled=\{[^}]+\}/g,
  /aria-disabled=\{[^}]+\}/g,
  /aria-hidden=\{[^}]+\}/g,
  /checked=\{[^}]+\}/g,
  /open=\{[^}]+\}/g,
  /hidden=\{[^}]+\}/g,
];

const SAFE_BOOLEAN_PATTERNS = [
  /booleanProp\(/,
  /anyTruthy\(/,
  /toDisabledBoolean\(/,
  /controlsDisabled/,
  /proposeDisabled/,
  /askDisabled/,
  /pending/,
  /disabled=\{false\}/,
  /disabled=\{true\}/,
  /open=\{booleanProp\(/,
];

const LIVE_MULTI_DAY =
  "Assign Test employee 2 to Customer 2 from July 20 through July 24, 8:00 AM to 4:00 PM each day.";

function buildContext(): BrainContextSnapshot {
  return {
    businessProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    businessName: "Test Business",
    generatedAt: "2026-07-13T18:00:00.000Z",
    displayName: "Owner",
    today: "2026-07-13",
    tomorrow: "2026-07-14",
    counts: {
      customers: 2,
      employees: 2,
      appointmentsToday: 0,
      appointmentsTomorrow: 0,
      overdueTasks: 0,
      openTasks: 0,
      unassignedAppointments: 0,
      draftInvoices: 0,
      overdueInvoices: 0,
      outstandingBalance: 0,
      proposedActions: 0,
      unreadNotifications: 0,
    },
    todayAppointments: [],
    tomorrowAppointments: [],
    overdueTasks: [],
    employeeWorkloads: [],
    customerDirectory: [
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [
      { id: "22222222-2222-4222-8222-222222222222", name: "Test employee 2", status: "active" },
    ],
    schedulingConflicts: [],
    inactiveCustomers: [],
    overdueInvoices: [],
    outstandingInvoices: [],
    recentActivities: [],
    recommendations: [],
    proposedActions: [],
    recentCompletedActions: [],
    recentNotifications: [],
    ruleBasedBriefing: {
      intro: "No appointments today.",
      bullets: [],
      highestPriority: { text: "Review schedule.", href: null },
    },
    topRecommendations: [],
    businessOperatingSettings: {
      profile: {
        timezone: "America/Denver",
        businessName: "Test Business",
      },
    },
    operationalFindings: [],
    contextFocus: "full",
  };
}

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

function expectBoolean(value: unknown, label: string) {
  expect(value, label).not.toBeNull();
  expect(value, label).not.toBeUndefined();
  expect(typeof value, label).toBe("boolean");
}

describe("booleanProp and anyTruthy", () => {
  it("never returns null or undefined", () => {
    expect(booleanProp(null)).toBe(false);
    expect(booleanProp(undefined)).toBe(false);
    expect(booleanProp(false)).toBe(false);
    expect(booleanProp(true)).toBe(true);
    expect(anyTruthy(null, undefined, false)).toBe(false);
    expect(anyTruthy(null, "x")).toBe(true);
    expect(typeof booleanProp(null)).toBe("boolean");
  });

  it("assertBooleanProp throws in test when value is null", () => {
    expect(() => assertBooleanProp("disabled", null)).toThrow(/Boolean prop "disabled"/);
    expect(() => assertBooleanProp("disabled", undefined)).toThrow(/Boolean prop "disabled"/);
    expect(assertBooleanProp("disabled", true)).toBe(true);
  });
});

describe("createHydrationSafeAssistantControls", () => {
  it("empty Ask Pluto input matches on server and initial client", () => {
    const server = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: false,
      question: "",
      hasResponse: false,
    });
    const client = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: false,
      question: "",
      hasResponse: false,
    });

    expectBoolean(server.askDisabled, "askDisabled");
    expectBoolean(server.controlsDisabled, "controlsDisabled");
    expect(server).toEqual(client);
    expect(server.askDisabled).toBe(true);
    expect(server.controlsDisabled).toBe(false);
    expect(server.displayQuestion).toBe("");
    expect(server.showResponse).toBe(false);
  });

  it("valid question entered enables Ask only after hydration", () => {
    const before = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: false,
      question: "What needs attention?",
      hasResponse: false,
    });
    const after = createHydrationSafeAssistantControls({
      isHydrated: true,
      isPending: false,
      question: "What needs attention?",
      hasResponse: false,
    });

    expect(before.askDisabled).toBe(true);
    expect(after.askDisabled).toBe(false);
  });

  it("submitting state disables controls after hydration", () => {
    const controls = createHydrationSafeAssistantControls({
      isHydrated: true,
      isPending: true,
      question: "What needs attention?",
      hasResponse: false,
    });

    expect(controls.askDisabled).toBe(true);
    expect(controls.controlsDisabled).toBe(true);
  });

  it("pending clarification stays disabled before hydration", () => {
    const restored = applyPlutoAskSuccess(createInitialPlutoAssistantState(), buildResponse(), "Help");
    const controls = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: false,
      question: restored.question,
      hasResponse: Boolean(restored.response),
    });

    expect(controls.askDisabled).toBe(true);
    expect(controls.displayQuestion).toBe("");
    expect(controls.showResponse).toBe(false);
  });

  it("pending proposal renders only after hydration", () => {
    const restored = applyPlutoAskSuccess(
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

    const before = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: false,
      question: restored.question,
      hasResponse: Boolean(restored.response),
    });
    const after = createHydrationSafeAssistantControls({
      isHydrated: true,
      isPending: false,
      question: restored.question,
      hasResponse: Boolean(restored.response),
    });

    expect(before.showResponse).toBe(false);
    expect(after.showResponse).toBe(true);
  });

  it("multi-day assignment proposal keeps deterministic disabled state before hydration", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_MULTI_DAY,
      buildContext(),
      [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Customer 2", company: "Test com 2" }],
      [{ id: "22222222-2222-4222-8222-222222222222", name: "Test employee 2", status: "active" }],
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const controls = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: false,
      question: LIVE_MULTI_DAY,
      hasResponse: true,
    });

    expectBoolean(controls.askDisabled, "multi-day askDisabled");
    expect(controls.askDisabled).toBe(true);
    expect(validateMultiDayAssignmentProposal(intent.suggestedAction).valid).toBe(true);
  });

  it("malformed multi-day proposal would disable Confirm & propose", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_MULTI_DAY,
      buildContext(),
      [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Customer 2", company: "Test com 2" }],
      [{ id: "22222222-2222-4222-8222-222222222222", name: "Test employee 2", status: "active" }],
    );
    if (intent.kind !== "action") throw new Error("expected action");

    const malformed = {
      ...intent.suggestedAction,
      payload: {
        ...intent.suggestedAction.payload,
        entry_count: 6,
      },
    };

    const validation = validateMultiDayAssignmentProposal(malformed);
    expect(validation.valid).toBe(false);
    expect(booleanProp(anyTruthy(false, !validation.valid))).toBe(true);
  });

  it("drawer restored after navigation uses pre-hydration defaults", () => {
    const restored = applyPlutoAskSuccess(
      createInitialPlutoAssistantState(),
      buildResponse(),
      "Follow up today",
    );

    expect(
      createHydrationSafeAssistantControls({
        isHydrated: false,
        isPending: false,
        question: restored.question,
        hasResponse: Boolean(restored.response),
      }).askDisabled,
    ).toBe(
      computeHydrationSafeAskDisabled({
        isHydrated: false,
        isPending: false,
        question: restored.question,
      }),
    );
  });

  it("Employee Schedule entry matches server and initial client disabled state", () => {
    const controls = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: null,
      question: null,
      hasResponse: false,
    });

    expectBoolean(controls.askDisabled, "employee schedule askDisabled");
    expectBoolean(controls.controlsDisabled, "employee schedule controlsDisabled");
    expect(controls.askDisabled).toBe(true);
  });
});

describe("hydration-safe Ask button label", () => {
  it("server and first client render both show Ask", () => {
    const server = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: true,
      question: "What needs attention?",
      hasResponse: false,
    });
    const client = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: true,
      question: "What needs attention?",
      hasResponse: false,
    });

    expect(server.askLabel).toBe("Ask");
    expect(client.askLabel).toBe("Ask");
    expect(server.askLabel).toBe(client.askLabel);
    expect(server.isBusy).toBe(false);
  });

  it("shows Analyzing only after hydration when ask transition is pending", () => {
    const before = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: true,
      question: "What needs attention?",
      hasResponse: false,
    });
    const after = createHydrationSafeAssistantControls({
      isHydrated: true,
      isPending: true,
      question: "What needs attention?",
      hasResponse: false,
    });

    expect(before.askLabel).toBe("Ask");
    expect(after.askLabel).toBe("Analyzing…");
    expect(after.isBusy).toBe(true);
    expect(after.askDisabled).toBe(true);
  });

  it("badge refresh pending state does not affect ask label helpers", () => {
    expect(
      computeHydrationSafeAskBusy({
        isHydrated: true,
        isPending: false,
        question: "Hello",
      }),
    ).toBe(false);
    expect(computeAskButtonLabel(false)).toBe("Ask");
    expect(computeAskButtonLabel(true)).toBe("Analyzing…");
  });

  it("restored conversation does not restore busy label before hydration", () => {
    const restored = applyPlutoAskSuccess(
      createInitialPlutoAssistantState(),
      buildResponse(),
      "Follow up today",
    );

    const controls = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: true,
      question: restored.question,
      hasResponse: Boolean(restored.response),
    });

    expect(controls.askLabel).toBe("Ask");
    expect(controls.isBusy).toBe(false);
  });

  it("navigation after prior busy state restores idle label on hard refresh baseline", () => {
    const controls = createHydrationSafeAssistantControls({
      isHydrated: false,
      isPending: false,
      question: "",
      hasResponse: false,
    });

    expect(controls.askLabel).toBe("Ask");
    expect(controls.isBusy).toBe(false);
  });
});

describe("hydration-safe Ask Pluto disabled state", () => {
  it("null pending clarification does not produce disabled=null", () => {
    const disabled = computeHydrationSafeAskDisabled({
      isHydrated: true,
      isPending: null,
      question: null,
    });
    expectBoolean(disabled, "null clarification");
    expect(disabled).toBe(true);
  });

  it("logical-or inputs never return null", () => {
    expectBoolean(toDisabledBoolean(null || undefined), "null || undefined");
    expectBoolean(toDisabledBoolean(null || true), "null || true");
    expect(computeAskButtonDisabled(null, null)).toBe(true);
  });
});

describe("Ask Pluto source hydration guards", () => {
  it("provider restores browser state only after hydration", () => {
    const providerSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-provider.tsx"),
      "utf8",
    );

    expect(providerSource).toContain("isHydrated");
    expect(providerSource).toContain("setIsHydrated(true)");
    expect(providerSource).toContain("isHydrated ? conversation.response : null");
    expect(providerSource).toMatch(/isHydrated\s*\?\s*normalizeAssistantQuestion/);
    expect(providerSource).toContain("startAskTransition");
    expect(providerSource).not.toMatch(/refreshBadge[\s\S]*startTransition/);
    expect(providerSource).not.toContain("sessionStorage");
    expect(providerSource).not.toContain("localStorage");
    expect(providerSource).not.toContain("useSearchParams");
  });

  it("PlutoAssistantContent uses centralized hydration-safe controls", () => {
    const contentSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-content.tsx"),
      "utf8",
    );

    expect(contentSource).toContain("createHydrationSafeAssistantControls");
    expect(contentSource).toContain("askLabel");
    expect(contentSource).toContain("booleanProp");
    expect(contentSource).not.toMatch(/isPending\s*\?\s*"Analyzing/);
    expect(contentSource).not.toContain("disabled={isPending");
    expect(contentSource).not.toContain("disabled={isPending ||");
    expect(contentSource).not.toContain("suppressHydrationWarning");
    expect(contentSource).not.toContain("Date.now()");
    expect(contentSource).not.toContain("typeof window");
  });

  it("every Ask Pluto boolean attribute uses a boolean-safe expression", () => {
    for (const relativePath of ASK_PLUTO_FILES) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");

      for (const pattern of BOOLEAN_ATTRIBUTE_PATTERNS) {
        const matches = source.match(pattern) ?? [];
        for (const prop of matches) {
          const isSafe = SAFE_BOOLEAN_PATTERNS.some((safePattern) => safePattern.test(prop));
          expect(isSafe, `${relativePath} has unsafe ${prop}`).toBe(true);
          expect(prop).not.toMatch(/\|\|/);
        }
      }
    }
  });

  it("no nullable disabled expressions remain in Ask Pluto tree", () => {
    for (const relativePath of ASK_PLUTO_FILES) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source).not.toMatch(/disabled=\{[^}]*\|\|[^}]*\}/);
    }
  });

  it("hard refresh baseline: all disabled props evaluate to booleans", () => {
    const scenarios = [
      { isHydrated: false, isPending: false, question: "", hasResponse: false },
      { isHydrated: false, isPending: null, question: null, hasResponse: false },
      { isHydrated: true, isPending: false, question: "Hello", hasResponse: false },
      { isHydrated: true, isPending: true, question: "Hello", hasResponse: true },
    ];

    for (const scenario of scenarios) {
      const controls = createHydrationSafeAssistantControls(scenario);
      expectBoolean(controls.askDisabled, JSON.stringify(scenario));
      expectBoolean(controls.controlsDisabled, JSON.stringify(scenario));
      expectBoolean(controls.showResponse, JSON.stringify(scenario));
    }
  });
});

describe("restored assistant state hydration safety", () => {
  it("gated question matches getHydrationSafeQuestion", () => {
    const restored = applyPlutoAskSuccess(
      createInitialPlutoAssistantState(),
      buildResponse(),
      "Follow up today",
    );

    expect(getHydrationSafeQuestion(false, restored.question)).toBe("");
    expect(getHydrationSafeQuestion(true, restored.question)).toBe("Follow up today");
    expect(shouldRenderHydratedAssistantUi(false)).toBe(false);
    expect(shouldRenderHydratedAssistantUi(true)).toBe(true);
  });

  it("null pending proposal state does not produce disabled=null", () => {
    const restored = applyPlutoAskSuccess(createInitialPlutoAssistantState(), buildResponse());
    const disabled = computeHydrationSafeControlsDisabled({
      isHydrated: true,
      isPending: null,
      question: restored.question,
    });
    expectBoolean(disabled, "null proposal controls");
    expect(disabled).toBe(false);
  });
});
