import { describe, expect, it } from "vitest";
import {
  customersMatchedByCompany,
  entityBelongsToContextBusiness,
  findAppointmentsByCustomerAndDate,
  formatCustomerDisplay,
  normalizeEntityName,
  parseAssignEmployeeRequest,
  resolveActiveEmployeeByName,
  resolveCustomerReference,
  resolveByName,
} from "@/lib/brain/entity-resolution";
import type { BrainContextSnapshot } from "@/lib/brain/types";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_C = "12121212-1212-4121-8121-121212121212";
const EMPLOYEE_A = "11111111-1111-4111-8111-111111111111";
const APPOINTMENT_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function buildContext(
  overrides?: Partial<BrainContextSnapshot>,
): BrainContextSnapshot {
  return {
    businessProfileId: BUSINESS_A,
    businessName: "Test",
    generatedAt: new Date().toISOString(),
    displayName: "Owner",
    today: "2026-07-12",
    tomorrow: "2026-07-13",
    counts: {
      customers: 3,
      employees: 1,
      appointmentsToday: 0,
      appointmentsTomorrow: 1,
      overdueTasks: 0,
      openTasks: 0,
      unassignedAppointments: 1,
      draftInvoices: 0,
      overdueInvoices: 0,
      outstandingBalance: 0,
      proposedActions: 0,
      unreadNotifications: 0,
    },
    todayAppointments: [],
    tomorrowAppointments: [
      {
        id: APPOINTMENT_A,
        title: "Visit",
        date: "2026-07-13",
        time: "09:00–10:00",
        customer: "Test com 2",
        customerId: CUSTOMER_B,
        employee: null,
        status: "scheduled",
      },
    ],
    overdueTasks: [],
    employeeWorkloads: [],
    customerDirectory: [
      { id: CUSTOMER_A, name: "Acme", company: null },
      { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [
      { id: EMPLOYEE_A, name: "Test employee 1", status: "active" },
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
      intro: "Test",
      bullets: [],
      highestPriority: null,
    },
    topRecommendations: [],
    businessOperatingSettings: {
      profile: { timezone: "America/Denver", businessName: "Test" },
    },
    operationalFindings: [],
    contextFocus: "full",
    ...overrides,
  };
}

describe("entity resolution helpers", () => {
  it("normalizes names case-insensitively and trims punctuation", () => {
    expect(normalizeEntityName("  Test   Com 2!!! ")).toBe("test com 2");
    expect(normalizeEntityName("TEST EMPLOYEE 1")).toBe("test employee 1");
  });

  it("parses assign request fields from natural language", () => {
    const parsed = parseAssignEmployeeRequest(
      "Assign Test employee 1 to my appointment with Test com 2 tomorrow",
    );
    expect(parsed.employeeName).toBe("Test employee 1");
    expect(parsed.customerName).toBe("Test com 2");
    expect(parsed.datePhrase).toBe("tomorrow");
  });

  it("resolves unique partial matches only when unambiguous", () => {
    const many = resolveByName("test", [
      { id: "1", name: "Test employee 1" },
      { id: "2", name: "Test employee 2" },
    ]);
    expect(many.kind).toBe("many");

    const one = resolveByName("employee 1", [
      { id: "1", name: "Test employee 1" },
      { id: "2", name: "Test employee 2" },
    ]);
    expect(one.kind).toBe("one");
  });

  it("rejects entities that are not in the authenticated business context", () => {
    const context = buildContext();
    const foreignEmployee = "99999999-9999-4999-8999-999999999999";

    expect(entityBelongsToContextBusiness(context, "employee", EMPLOYEE_A)).toBe(true);
    expect(entityBelongsToContextBusiness(context, "employee", foreignEmployee)).toBe(
      false,
    );
    expect(entityBelongsToContextBusiness(context, "customer", CUSTOMER_B)).toBe(true);
    expect(entityBelongsToContextBusiness(context, "appointment", APPOINTMENT_A)).toBe(
      true,
    );

    const employee = resolveActiveEmployeeByName("Test employee 1", context);
    expect(employee.kind).toBe("one");
    if (employee.kind !== "one") return;
    expect(employee.entity.id).toBe(EMPLOYEE_A);
  });
});

describe("customer reference resolution", () => {
  it("resolves customers by customer name", () => {
    const match = resolveCustomerReference("Customer 2", buildContext());
    expect(match.kind).toBe("one");
    if (match.kind !== "one") return;
    expect(match.entity.id).toBe(CUSTOMER_B);
    expect(match.entity.name).toBe("Customer 2");
  });

  it("resolves customers by company name", () => {
    const match = resolveCustomerReference("Test com 2", buildContext());
    expect(match.kind).toBe("one");
    if (match.kind !== "one") return;
    expect(match.entity.id).toBe(CUSTOMER_B);
    expect(match.entity.company).toBe("Test com 2");
  });

  it("matches company names case-insensitively", () => {
    const match = resolveCustomerReference("TEST COM 2", buildContext());
    expect(match.kind).toBe("one");
    if (match.kind !== "one") return;
    expect(match.entity.id).toBe(CUSTOMER_B);
  });

  it("normalizes punctuation and spacing for company references", () => {
    const match = resolveCustomerReference("  test   com  2!!! ", buildContext());
    expect(match.kind).toBe("one");
    if (match.kind !== "one") return;
    expect(match.entity.id).toBe(CUSTOMER_B);
  });

  it("requires clarification when multiple customers share a company name", () => {
    const context = buildContext({
      customerDirectory: [
        { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
        { id: CUSTOMER_C, name: "Customer 3", company: "Test com 2" },
      ],
    });

    const match = resolveCustomerReference("Test com 2", context);
    expect(match.kind).toBe("many");
    if (match.kind !== "many") return;
    expect(customersMatchedByCompany("Test com 2", match.entities)).toBe(true);
    expect(match.entities.map((customer) => customer.name)).toEqual([
      "Customer 2",
      "Customer 3",
    ]);
  });

  it("rejects customers outside the authenticated business directory", () => {
    const context = buildContext({
      customerDirectory: [{ id: CUSTOMER_A, name: "Acme", company: null }],
    });

    const match = resolveCustomerReference("Test com 2", context);
    expect(match.kind).toBe("none");
    expect(entityBelongsToContextBusiness(context, "customer", CUSTOMER_B)).toBe(false);
  });

  it("finds appointments using the resolved customer ID", () => {
    const context = buildContext();
    const customer = resolveCustomerReference("Test com 2", context);
    expect(customer.kind).toBe("one");
    if (customer.kind !== "one") return;

    const matches = findAppointmentsByCustomerAndDate(
      context,
      customer.entity,
      "2026-07-13",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe(APPOINTMENT_A);
    expect(matches[0]?.customerId).toBe(CUSTOMER_B);
  });

  it("formats canonical customer display with name and company", () => {
    expect(
      formatCustomerDisplay({
        id: CUSTOMER_B,
        name: "Customer 2",
        company: "Test com 2",
      }),
    ).toBe("Customer 2 — Test com 2");
  });

  it("still resolves exact customer-name matches without weakening name lookup", () => {
    const match = resolveCustomerReference("Acme", buildContext());
    expect(match.kind).toBe("one");
    if (match.kind !== "one") return;
    expect(match.entity.name).toBe("Acme");
  });
});
