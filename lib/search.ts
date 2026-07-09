import { createClient } from "@/lib/supabase/server";
import { formatDisplayDate, formatTimeDisplay } from "@/lib/appointments/datetime";
import { STATUS_LABELS as APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/types";
import { STATUS_LABELS as TASK_STATUS_LABELS } from "@/lib/tasks/types";
import type {
  GlobalSearchResult,
  GlobalSearchResults,
} from "@/lib/search/types";

const RESULT_LIMIT = 5;

function sanitizeSearchQuery(query: string) {
  return query.trim().replace(/,/g, " ").slice(0, 100);
}

function buildIlikePattern(query: string) {
  const sanitized = sanitizeSearchQuery(query);
  const escaped = sanitized.replace(/[%_\\]/g, "\\$&");
  return `%${escaped}%`;
}

function buildCustomerSubtitle(customer: {
  company: string | null;
  email: string | null;
  phone: string | null;
}) {
  return customer.company || customer.email || customer.phone || "Customer";
}

function buildTaskSubtitle(task: {
  status: string;
  due_date: string | null;
  customers: { name: string } | null;
}) {
  const parts: string[] = [];

  if (task.customers?.name) {
    parts.push(task.customers.name);
  }

  parts.push(TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]);

  if (task.due_date) {
    parts.push(`Due ${formatDisplayDate(task.due_date)}`);
  }

  return parts.join(" · ");
}

function buildAppointmentSubtitle(appointment: {
  appointment_date: string;
  start_time: string;
  status: string;
  customers: { name: string; company: string | null } | null;
}) {
  const parts: string[] = [];

  if (appointment.customers?.name) {
    parts.push(appointment.customers.name);
  } else if (appointment.customers?.company) {
    parts.push(appointment.customers.company);
  }

  parts.push(formatDisplayDate(appointment.appointment_date));
  parts.push(formatTimeDisplay(appointment.start_time));
  parts.push(
    APPOINTMENT_STATUS_LABELS[
      appointment.status as keyof typeof APPOINTMENT_STATUS_LABELS
    ],
  );

  return parts.join(" · ");
}

function buildTaskHref(task: { id: string; customer_id: string | null }) {
  if (task.customer_id) {
    return `/dashboard/customers/${task.customer_id}?tab=tasks`;
  }

  return "/dashboard/tasks";
}

function buildAppointmentHref(appointment: {
  id: string;
  customer_id: string;
  appointment_date: string;
}) {
  return `/dashboard/customers/${appointment.customer_id}?tab=appointments`;
}

export async function globalSearch(
  businessProfileId: string,
  query: string,
): Promise<GlobalSearchResults> {
  const sanitized = sanitizeSearchQuery(query);

  if (sanitized.length < 2) {
    return { customers: [], tasks: [], appointments: [] };
  }

  const pattern = buildIlikePattern(sanitized);
  const supabase = await createClient();

  const [customersResult, tasksResult, appointmentsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, email, phone")
      .eq("business_profile_id", businessProfileId)
      .or(
        `name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
      )
      .order("name", { ascending: true })
      .limit(RESULT_LIMIT),
    supabase
      .from("tasks")
      .select("id, title, status, due_date, customer_id, customers(name)")
      .eq("business_profile_id", businessProfileId)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from("appointments")
      .select(
        "id, title, appointment_date, start_time, status, customer_id, customers(name, company)",
      )
      .eq("business_profile_id", businessProfileId)
      .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
      .order("appointment_date", { ascending: false })
      .limit(RESULT_LIMIT),
  ]);

  if (customersResult.error) {
    throw new Error(customersResult.error.message);
  }

  if (tasksResult.error) {
    throw new Error(tasksResult.error.message);
  }

  if (appointmentsResult.error) {
    throw new Error(appointmentsResult.error.message);
  }

  const customers: GlobalSearchResult[] = (customersResult.data ?? []).map(
    (customer) => ({
      id: customer.id,
      type: "customer",
      name: customer.name,
      subtitle: buildCustomerSubtitle(customer),
      href: `/dashboard/customers/${customer.id}`,
    }),
  );

  const tasks: GlobalSearchResult[] = (tasksResult.data ?? []).map((task) => {
    const customer = Array.isArray(task.customers)
      ? task.customers[0] ?? null
      : task.customers;

    return {
      id: task.id,
      type: "task" as const,
      name: task.title,
      subtitle: buildTaskSubtitle({
        status: task.status,
        due_date: task.due_date,
        customers: customer,
      }),
      href: buildTaskHref(task),
    };
  });

  const appointments: GlobalSearchResult[] = (
    appointmentsResult.data ?? []
  ).map((appointment) => {
    const customer = Array.isArray(appointment.customers)
      ? appointment.customers[0] ?? null
      : appointment.customers;

    return {
      id: appointment.id,
      type: "appointment" as const,
      name: appointment.title,
      subtitle: buildAppointmentSubtitle({
        appointment_date: appointment.appointment_date,
        start_time: appointment.start_time,
        status: appointment.status,
        customers: customer,
      }),
      href: buildAppointmentHref(appointment),
    };
  });

  return { customers, tasks, appointments };
}
