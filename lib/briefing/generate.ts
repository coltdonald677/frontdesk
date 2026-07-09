import { formatTimeDisplay } from "@/lib/appointments/datetime";
import { getBriefingInput } from "@/lib/briefing/data";
import type {
  BriefingBullet,
  BriefingInput,
  DailyBriefing,
} from "@/lib/briefing/types";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function formatCountBullet(
  count: number,
  singular: string,
  plural: string,
  href?: string,
): BriefingBullet | null {
  if (count <= 0) {
    return null;
  }

  return {
    text: `${count} ${count === 1 ? singular : plural}`,
    href,
  };
}

function getCustomerLabel(customer: {
  name: string;
  company: string | null;
}) {
  return customer.company || customer.name;
}

function buildHighestPriority(input: BriefingInput): BriefingBullet | null {
  const nextAppointment = [...input.appointmentsToday].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  )[0];

  if (nextAppointment) {
    const customerName =
      nextAppointment.customers?.company ||
      nextAppointment.customers?.name ||
      "your client";
    const time = formatTimeDisplay(nextAppointment.start_time);
    const title = nextAppointment.title.toLowerCase();
    const verb = title.includes("call")
      ? "Call"
      : title.includes("follow")
        ? "Follow up with"
        : "Meet with";

    return {
      text: `${verb} ${customerName} before ${time}.`,
      href: `/dashboard/customers/${nextAppointment.customer_id}?tab=appointments`,
    };
  }

  const overdueTask = input.overdueTasks[0];

  if (overdueTask) {
    const customerName = overdueTask.customers?.name;
    const label = customerName
      ? `Follow up with ${customerName}`
      : `Complete "${overdueTask.title}"`;

    return {
      text: `${label} — overdue and needs attention.`,
      href: overdueTask.customer_id
        ? `/dashboard/customers/${overdueTask.customer_id}?tab=tasks`
        : "/dashboard/tasks",
    };
  }

  const dueTodayTask = [...input.tasksDueToday].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.priority] - rank[b.priority];
  })[0];

  if (dueTodayTask) {
    const customerName = dueTodayTask.customers?.name;
    const label = customerName
      ? `Reach out to ${customerName}`
      : `Complete "${dueTodayTask.title}"`;

    return {
      text: `${label} before the day ends.`,
      href: dueTodayTask.customer_id
        ? `/dashboard/customers/${dueTodayTask.customer_id}?tab=tasks`
        : "/dashboard/tasks",
    };
  }

  if (input.inactiveCustomers.length === 1) {
    const customer = input.inactiveCustomers[0];

    return {
      text: `Check in with ${getCustomerLabel(customer)} — no activity in the last 30 days.`,
      href: `/dashboard/customers/${customer.id}?tab=activity`,
    };
  }

  return null;
}

function buildSuggestions(input: BriefingInput): string[] {
  const suggestions: string[] = [];

  if (input.totalCustomers === 0) {
    suggestions.push(
      "Add your first customer to start building your CRM pipeline.",
    );
  }

  if (
    input.totalCustomers > 0 &&
    input.appointmentsToday.length === 0 &&
    input.appointmentsThisWeek === 0
  ) {
    suggestions.push(
      "No appointments on the books — schedule time with a customer this week.",
    );
  }

  if (
    input.overdueTasksCount === 0 &&
    input.tasksDueTodayCount === 0 &&
    input.totalCustomers > 0
  ) {
    suggestions.push(
      "Create follow-up tasks so nothing slips through the cracks.",
    );
  }

  if (input.inactiveCustomers.length > 0) {
    suggestions.push(
      `Reach out to ${input.inactiveCustomers.length} customer${input.inactiveCustomers.length === 1 ? "" : "s"} who haven't had activity in 30 days.`,
    );
  }

  if (input.customersAddedThisWeek > 0) {
    suggestions.push(
      `Welcome ${input.customersAddedThisWeek} new customer${input.customersAddedThisWeek === 1 ? "" : "s"} added this week with a quick intro note.`,
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "You're in great shape today. Review your schedule or plan ahead for tomorrow.",
    );
  }

  return suggestions;
}

export function generateDailyBriefing(input: BriefingInput): DailyBriefing {
  const greeting = `${getGreeting()}, ${input.displayName}.`;
  const bullets = [
    formatCountBullet(
      input.appointmentsToday.length,
      "appointment today",
      "appointments today",
      "/dashboard/schedule",
    ),
    formatCountBullet(
      input.overdueTasksCount,
      "overdue task",
      "overdue tasks",
      "/dashboard/tasks",
    ),
    formatCountBullet(
      input.tasksDueTodayCount,
      "task due today",
      "tasks due today",
      "/dashboard/tasks",
    ),
    input.inactiveCustomers.length > 0
      ? {
          text: `${input.inactiveCustomers.length} inactive ${pluralize(input.inactiveCustomers.length, "customer")} that should be contacted`,
          href: "/dashboard/customers",
        }
      : null,
    formatCountBullet(
      input.customersAddedThisWeek,
      "customer added this week",
      "customers added this week",
      "/dashboard/customers",
    ),
    formatCountBullet(
      input.appointmentsThisWeek,
      "appointment remaining this week",
      "appointments remaining this week",
      "/dashboard/schedule",
    ),
  ].filter((bullet): bullet is BriefingBullet => bullet !== null);

  const hasActionItems = bullets.length > 0;
  const highestPriority = buildHighestPriority(input);
  const isQuietDay =
    !hasActionItems && highestPriority === null && input.totalCustomers > 0;

  return {
    greeting,
    intro: hasActionItems ? "You have:" : "Here's what I'd focus on today:",
    bullets,
    highestPriority,
    suggestions: hasActionItems ? [] : buildSuggestions(input),
    isQuietDay,
  };
}

export async function getDailyBriefing(
  businessProfileId: string,
  displayName: string,
) {
  const input = await getBriefingInput(businessProfileId, displayName);
  return generateDailyBriefing(input);
}
