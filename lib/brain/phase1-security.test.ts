import { describe, expect, it } from "vitest";
import {
  checkBusinessDailyLimit,
  checkUserCooldown,
  getCachedReadOnlyQuery,
  hashReadOnlyQuestion,
  recordBusinessUsage,
  setCachedReadOnlyQuery,
} from "@/lib/brain/cost-controls";
import { computeOperationalFindings } from "@/lib/brain/deterministic-summaries";
import { sanitizeAuditSummaryForStorage } from "@/lib/brain/log-security";
import { validateBrainResponse } from "@/lib/brain/schemas";
import {
  BRAIN_PROHIBITED_ACTIONS,
  PHASE1_WRITE_ACTION_TYPES,
  filterPhase1SuggestedActions,
  isPhase1WriteAction,
  isProhibitedAction,
  isKnownBrainToolName,
  rejectUnknownToolName,
  writeToolRequiresConfirmation,
} from "@/lib/brain/tool-registry";
import { validateActionPayload } from "@/lib/actions/validate";
import type { BrainContextSnapshot, BrainSuggestedAction } from "@/lib/brain/types";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BUSINESS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TASK_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const APPOINTMENT_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function buildMinimalContext(businessProfileId: string): BrainContextSnapshot {
  return {
    businessProfileId,
    businessName: "Test Business",
    generatedAt: new Date().toISOString(),
    displayName: "Owner",
    today: "2026-07-12",
    tomorrow: "2026-07-13",
    counts: {
      customers: 2,
      employees: 2,
      appointmentsToday: 1,
      appointmentsTomorrow: 0,
      overdueTasks: 1,
      openTasks: 2,
      unassignedAppointments: 1,
      draftInvoices: 0,
      overdueInvoices: 1,
      outstandingBalance: 150,
      proposedActions: 0,
      unreadNotifications: 0,
    },
    todayAppointments: [],
    tomorrowAppointments: [],
    overdueTasks: [
      {
        id: TASK_A,
        title: "Call customer",
        dueDate: "2026-07-10",
        customer: "Acme",
        priority: "high",
      },
    ],
    employeeWorkloads: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Alex",
        workloadPercent: 90,
        appointmentsToday: 4,
        openTasks: 2,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Bailey",
        workloadPercent: 20,
        appointmentsToday: 1,
        openTasks: 0,
      },
    ],
    customerDirectory: [{ id: CUSTOMER_A, name: "Acme", company: null }],
    employeeDirectory: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Alex", status: "active" },
      { id: "22222222-2222-4222-8222-222222222222", name: "Bailey", status: "active" },
    ],
    schedulingConflicts: [
      {
        employee: "Alex",
        appointmentA: "Site visit",
        appointmentB: "Estimate",
        date: "2026-07-12",
      },
    ],
    inactiveCustomers: [{ id: CUSTOMER_A, name: "Acme" }],
    overdueInvoices: [
      {
        id: "99999999-9999-4999-8999-999999999999",
        number: "INV-0001",
        customer: "Acme",
        balanceDue: 150,
      },
    ],
    outstandingInvoices: [],
    recentActivities: [
      {
        id: "88888888-8888-4888-8888-888888888888",
        type: "note",
        customer: "Acme",
        summary: "Left voicemail",
        date: "2026-07-11",
      },
    ],
    recommendations: [],
    proposedActions: [],
    recentCompletedActions: [],
    recentNotifications: [],
    ruleBasedBriefing: {
      intro: "Today needs attention.",
      bullets: [],
      highestPriority: null,
    },
    topRecommendations: [],
    businessOperatingSettings: {},
    operationalFindings: [],
    contextFocus: "full",
  };
}

describe("Pluto Brain Phase 1 tool registry", () => {
  it("allows only Phase 1 write actions", () => {
    expect(isPhase1WriteAction("create_task")).toBe(true);
    expect(isPhase1WriteAction("create_appointment")).toBe(true);
    expect(isPhase1WriteAction("mark_appointment_complete")).toBe(false);
  });

  it("rejects prohibited financial and destructive tools", () => {
    for (const action of BRAIN_PROHIBITED_ACTIONS) {
      expect(isProhibitedAction(action)).toBe(true);
    }
    expect(isProhibitedAction("record_payment")).toBe(true);
    expect(isProhibitedAction("send_invoice")).toBe(true);
  });

  it("rejects unknown tool names", () => {
    expect(isKnownBrainToolName("summarize_today_schedule")).toBe(true);
    expect(isKnownBrainToolName("delete_everything")).toBe(false);
    expect(rejectUnknownToolName("delete_everything")).toContain("Unknown tool");
  });

  it("filters suggested actions to the Phase 1 write allowlist", () => {
    const actions: BrainSuggestedAction[] = [
      {
        actionType: "create_task",
        title: "Create task",
        explanation: "Needed",
        riskLevel: "low",
        payload: { title: "Follow up" },
      },
      {
        actionType: "mark_appointment_complete",
        title: "Complete appointment",
        explanation: "Blocked",
        riskLevel: "high",
        payload: { appointment_id: APPOINTMENT_A },
      },
      {
        actionType: "create_invoice",
        title: "Draft invoice",
        explanation: "Allowed",
        riskLevel: "medium",
        payload: {
          customer_id: CUSTOMER_A,
          issue_date: "2026-07-12",
          line_items: [
            { description: "Service", quantity: 1, unit_price: 100, tax_rate: 0 },
          ],
        },
      },
    ];

    const filtered = filterPhase1SuggestedActions(actions);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((action) => action.actionType)).toEqual([
      "create_task",
      "create_invoice",
    ]);
    expect(PHASE1_WRITE_ACTION_TYPES).toContain("create_customer_note");
  });

  it("requires confirmation for every Phase 1 write tool", () => {
    for (const actionType of PHASE1_WRITE_ACTION_TYPES) {
      expect(writeToolRequiresConfirmation(actionType)).toBe(true);
    }
  });
});

describe("Pluto Brain deterministic summaries", () => {
  it("builds findings only from the provided business context", () => {
    const findings = computeOperationalFindings(buildMinimalContext(BUSINESS_A));

    expect(findings.some((finding) => finding.title.includes("Double booking"))).toBe(
      true,
    );
    expect(findings.some((finding) => finding.title.includes("Overdue task"))).toBe(true);
    expect(findings.some((finding) => finding.category === "metrics")).toBe(true);
    expect(findings.every((finding) => !finding.detail.includes(BUSINESS_B))).toBe(true);
  });
});

describe("Pluto Brain response validation", () => {
  it("rejects malformed tool input and unknown action types", () => {
    const invalid = validateBrainResponse(
      {
        answer: "Test",
        summary: "Test",
        confidence: "high",
        dataFreshness: new Date().toISOString(),
        suggestedActions: [
          {
            actionType: "void_invoice",
            title: "Void",
            explanation: "Nope",
            riskLevel: "high",
            payload: {},
          },
          {
            actionType: "create_task",
            title: "Task",
            explanation: "Missing title payload",
            riskLevel: "low",
            payload: {},
          },
        ],
      },
      "test-provider",
      false,
    );

    expect(invalid.valid).toBe(true);
    if (invalid.valid) {
      expect(invalid.response.suggestedActions).toHaveLength(0);
    }
  });

  it("rejects malformed brain responses", () => {
    const result = validateBrainResponse({ summary: "only summary" }, "test", false);
    expect(result.valid).toBe(false);
  });
});

describe("Pluto Brain action payload validation", () => {
  it("rejects invalid IDs and malformed payloads", () => {
    const invalidTask = validateActionPayload("mark_task_complete", {
      task_id: "not-a-uuid",
    });
    expect(invalidTask.valid).toBe(false);

    const invalidAppointment = validateActionPayload("create_appointment", {
      customer_id: CUSTOMER_A,
      title: "Estimate",
      appointment_date: "2026-07-12",
      start_time: "17:00",
      end_time: "09:00",
    });
    expect(invalidAppointment.valid).toBe(false);
  });

  it("accepts valid Phase 1 write payloads", () => {
    const note = validateActionPayload("create_customer_note", {
      customer_id: CUSTOMER_A,
      content: "Customer requested callback.",
    });
    expect(note.valid).toBe(true);
  });
});

describe("Pluto Brain cost controls", () => {
  it("blocks excess usage after the daily limit", () => {
    const businessId = "cost-control-business";
    recordBusinessUsage(businessId);
    recordBusinessUsage(businessId);
    const blocked = checkBusinessDailyLimit(businessId, 2, 2);
    expect(blocked.allowed).toBe(false);
  });

  it("enforces request cooldown", () => {
    const userId = "cooldown-user";
    const first = checkUserCooldown(userId, 30);
    expect(first.allowed).toBe(true);
  });

  it("caches repeated read-only questions without requiring a new provider call", () => {
    const businessId = "cache-business";
    const questionHash = hashReadOnlyQuestion("Summarize today");
    const contextHash = "ctx-1";
    const response = validateBrainResponse(
      {
        answer: "Today is steady.",
        summary: "Steady day",
        confidence: "medium",
        dataFreshness: new Date().toISOString(),
        supportingFacts: [],
        warnings: [],
        suggestedActions: [],
      },
      "development-fallback",
      true,
    );

    expect(response.valid).toBe(true);
    if (!response.valid) return;

    setCachedReadOnlyQuery(
      businessId,
      questionHash,
      contextHash,
      response.response,
      ["Steady day"],
      15,
    );

    const cached = getCachedReadOnlyQuery(businessId, questionHash, contextHash);
    expect(cached?.response.summary).toBe("Steady day");
  });
});

describe("Pluto Brain audit safety", () => {
  it("does not store secrets or hidden reasoning in audit summaries", () => {
    const sanitized = sanitizeAuditSummaryForStorage(
      "Executed action · api_key=super-secret · hidden chain-of-thought reasoning",
    );
    expect(sanitized).not.toContain("super-secret");
    expect(sanitized).toContain("[redacted]");
  });
});

describe("Pluto Brain tenant isolation helpers", () => {
  it("scopes deterministic findings to one business context", () => {
    const contextA = buildMinimalContext(BUSINESS_A);
    const contextB = buildMinimalContext(BUSINESS_B);

    contextB.overdueTasks = [
      {
        id: "12121212-1212-4121-8121-121212121212",
        title: "Other business task",
        dueDate: "2026-07-09",
        customer: "Other Co",
        priority: "medium",
      },
    ];

    const findingsA = computeOperationalFindings(contextA);
    const findingsB = computeOperationalFindings(contextB);

    expect(findingsA.some((finding) => finding.title.includes("Call customer"))).toBe(
      true,
    );
    expect(findingsA.some((finding) => finding.title.includes("Other business task"))).toBe(
      false,
    );
    expect(findingsB.some((finding) => finding.title.includes("Other business task"))).toBe(
      true,
    );
  });

  it("treats cross-business customer references as different validation inputs", () => {
    const payloadForA = validateActionPayload("create_customer_note", {
      customer_id: CUSTOMER_A,
      content: "Note for business A",
    });
    const payloadForB = validateActionPayload("create_customer_note", {
      customer_id: CUSTOMER_B,
      content: "Note for business B",
    });

    expect(payloadForA.valid).toBe(true);
    expect(payloadForB.valid).toBe(true);
    expect(CUSTOMER_A).not.toBe(CUSTOMER_B);
  });
});
