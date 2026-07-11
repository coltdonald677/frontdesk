/**
 * Manual verification scenarios for Pluto Notification Center (development only).
 * These do not insert data — follow each step in the running app.
 */
export type NotificationTestScenario = {
  id: string;
  event: string;
  steps: string[];
  expectedType: string;
  expectedSeverity: string;
};

export const NOTIFICATION_TEST_SCENARIOS: NotificationTestScenario[] = [
  {
    id: "customer-created",
    event: "New customer created",
    steps: [
      "Go to /dashboard/customers",
      "Click Add customer, fill in a name, and save",
      "Open the bell — expect a success notification with a Schedule visit action",
    ],
    expectedType: "customer.created",
    expectedSeverity: "success",
  },
  {
    id: "appointment-assigned",
    event: "Appointment created (with employee)",
    steps: [
      "Go to /dashboard/schedule and create an appointment with a customer and employee",
      "Expect two notifications: Appointment scheduled (info) and Employee assigned (info)",
    ],
    expectedType: "appointment.created",
    expectedSeverity: "info",
  },
  {
    id: "appointment-unassigned",
    event: "Appointment created without employee",
    steps: [
      "Create an appointment without selecting an employee",
      "Expect Appointment scheduled (info) and Appointment needs an employee (warning)",
    ],
    expectedType: "appointment.unassigned",
    expectedSeverity: "warning",
  },
  {
    id: "appointment-completed",
    event: "Appointment completed",
    steps: [
      "Edit an existing appointment and set status to Completed, then save",
      "Expect Appointment completed (success) with a View customer action",
    ],
    expectedType: "appointment.completed",
    expectedSeverity: "success",
  },
  {
    id: "employee-assigned",
    event: "Employee assigned to appointment",
    steps: [
      "Edit an unassigned appointment and assign an employee, then save",
      "Expect Employee assigned (info) with a View employee action",
    ],
    expectedType: "employee.assigned",
    expectedSeverity: "info",
  },
  {
    id: "automation-success",
    event: "Automation succeeds",
    steps: [
      "Go to /dashboard/settings/automations",
      "Pick an automation with test data and click Run now",
      "Expect a success notification naming the automation",
    ],
    expectedType: "automation.success",
    expectedSeverity: "success",
  },
  {
    id: "automation-failed",
    event: "Automation fails",
    steps: [
      "Disable required data (e.g. delete all customers) then Run now on New Customer automation",
      "Or trigger an automation error via invalid state",
      "Expect a critical automation failed notification",
    ],
    expectedType: "automation.failed",
    expectedSeverity: "critical",
  },
  {
    id: "task-overdue",
    event: "Task becomes overdue",
    steps: [
      "Create an open task with a due date in the past",
      "Visit /dashboard (Mission Control) to trigger the overdue scan",
      "Expect Overdue task flagged (warning) with a View tasks action",
    ],
    expectedType: "task.overdue",
    expectedSeverity: "warning",
  },
  {
    id: "critical-recommendation",
    event: "Critical Pluto recommendation",
    steps: [
      "Create 3+ upcoming appointments without employees assigned",
      "Visit /dashboard to load recommendations",
      "Expect a critical recommendation notification in the bell",
    ],
    expectedType: "recommendation.critical",
    expectedSeverity: "critical",
  },
];
