export function getActionHref(action: {
  action_type: string;
  payload: Record<string, unknown>;
  related_entity_type: string | null;
  related_entity_id: string | null;
}): string | null {
  switch (action.action_type) {
    case "assign_employee_to_appointment":
    case "reschedule_appointment":
    case "mark_appointment_complete":
      return "/dashboard/schedule?date=today";
    case "assign_employee_to_task":
    case "mark_task_complete":
    case "create_task":
      return "/dashboard/tasks";
    case "create_customer_follow_up":
      return typeof action.payload.customer_id === "string"
        ? `/dashboard/customers/${action.payload.customer_id}`
        : "/dashboard/customers";
    case "create_invoice":
      return "/dashboard/invoices";
    default:
      if (action.related_entity_type === "customer" && action.related_entity_id) {
        return `/dashboard/customers/${action.related_entity_id}`;
      }
      return "/dashboard/actions";
  }
}
