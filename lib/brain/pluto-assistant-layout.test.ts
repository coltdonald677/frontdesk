import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateMultiDayAssignmentProposal } from "@/lib/brain/multi-day-assignment-parser";
import { resolveMultiDayAssignmentIntent } from "@/lib/brain/multi-day-assignment-parser";
import {
  getCompactConfirmFields,
  getProposalSubmissionSummary,
} from "@/lib/brain/proposal-submission-ui";
import type { BrainContextSnapshot } from "@/lib/brain/types";

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

function buildMultiDayAction() {
  const intent = resolveMultiDayAssignmentIntent(
    LIVE_MULTI_DAY,
    buildContext(),
    [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Customer 2", company: "Test com 2" }],
    [{ id: "22222222-2222-4222-8222-222222222222", name: "Test employee 2", status: "active" }],
  );
  if (intent.kind !== "action") {
    throw new Error("expected multi-day action");
  }
  return intent.suggestedAction;
}

describe("Ask Pluto drawer layout consistency", () => {
  it("drawer uses one flex column shell with a single scrollable body", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-drawer.tsx"),
      "utf8",
    );

    expect(source).toMatch(/h-dvh/);
    expect(source).toMatch(/max-h-dvh/);
    expect(source).toMatch(/flex-col/);
    expect(source).toMatch(/overflow-hidden/);
    expect(source).toMatch(/shrink-0/);
    expect(source).toMatch(/min-h-0 flex-1 overflow-y-auto/);
    expect(source).toMatch(/overscroll-contain/);
    expect(source).toMatch(/document\.body\.style\.overflow = "hidden"/);
    expect(source).not.toMatch(/overflow-hidden[^"]*">\s*<PlutoAssistantContent/);
  });

  it("drawer body keeps bottom padding so controls stay reachable", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-drawer.tsx"),
      "utf8",
    );

    expect(source).toMatch(/pb-8/);
  });

  it("close button remains in a non-scrolling header", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-drawer.tsx"),
      "utf8",
    );

    expect(source).toMatch(/shrink-0[\s\S]*Close Ask Pluto/);
    expect(source).toMatch(/PlutoAssistantContent embedded/);
  });
});

describe("proposal confirmation and success UI", () => {
  it("confirm dialog scrolls long proposal content instead of clipping it", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/proposal-confirm-dialog.tsx"),
      "utf8",
    );

    expect(source).toMatch(/max-h-\[min\(90dvh/);
    expect(source).toMatch(/flex-col/);
    expect(source).toMatch(/min-h-0 flex-1 overflow-y-auto/);
    expect(source).toMatch(/shrink-0[\s\S]*Cancel/);
    expect(source).not.toMatch(/overflow-hidden rounded-xl[\s\S]*space-y-3 px-5 py-4[\s\S]*<\/div>\s*<div className="flex justify-end/);
  });

  it("post-confirmation success state is compact with navigation actions", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/proposal-submitted-panel.tsx"),
      "utf8",
    );

    expect(source).toMatch(/Proposal sent to Action Center/);
    expect(source).toMatch(/Open Action Center/);
    expect(source).toMatch(/Back to Ask Pluto/);
    expect(source).toMatch(/Close/);
    expect(source).toMatch(/Proposed/);
  });

  it("proposal card switches to success panel instead of keeping the full proposal", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/brain-suggested-action-card.tsx"),
      "utf8",
    );

    expect(source).toMatch(/view === "success"/);
    expect(source).toMatch(/ProposalSubmittedPanel/);
    expect(source).toMatch(/view === "dismissed"/);
    expect(source).toMatch(/ProposalErrorBanner/);
    expect(source).not.toMatch(/fixed inset-0 z-50 flex items-center justify-center/);
  });

  it("failure path preserves proposal and exposes retry", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/brain-suggested-action-card.tsx"),
      "utf8",
    );

    expect(source).toMatch(/setError\(result\.error\)/);
    expect(source).toMatch(/setConfirmOpenState\(false\)/);
    expect(source).toMatch(/onRetry=\{runPropose\}/);
    expect(source).toMatch(/onCancel=\{\(\) => setError\(null\)\}/);
  });

  it("multi-day compact confirm fields omit the full included-dates wall", () => {
    const action = buildMultiDayAction();
    const compact = getCompactConfirmFields(action);
    const includedDates = compact.find((field) => field.label === "Included dates");

    expect(includedDates).toBeUndefined();
    expect(compact.find((field) => field.label === "Number of entries")?.value).toBe("5");
    expect(validateMultiDayAssignmentProposal(action).valid).toBe(true);
  });

  it("success summary exposes entry count for multi-day proposals", () => {
    const action = buildMultiDayAction();
    expect(getProposalSubmissionSummary(action)).toMatchObject({
      entryCount: "5",
      totalHours: "40 hours",
    });
  });
});

describe("drawer scroll container across state changes", () => {
  it("assistant content does not introduce a competing overflow shell", () => {
    const contentSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-content.tsx"),
      "utf8",
    );
    const cardSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/brain-suggested-action-card.tsx"),
      "utf8",
    );

    expect(contentSource).not.toMatch(/overflow-hidden/);
    expect(contentSource).not.toMatch(/h-full/);
    expect(contentSource).not.toMatch(/max-h-/);
    expect(cardSource).not.toMatch(/h-dvh/);
    expect(cardSource).not.toMatch(/overflow-hidden/);
  });

  it("escape still respects confirm dialog guard in drawer focus handler", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/brain/drawer-focus.ts"),
      "utf8",
    );

    expect(source).toMatch(/confirmDialogOpen/);
    expect(source).toMatch(/Escape/);
  });
});
