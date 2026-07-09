import type { AppointmentWithCustomer } from "@/lib/appointments/types";
import type { TaskWithCustomer } from "@/lib/tasks/types";

export type InactiveCustomer = {
  id: string;
  name: string;
  company: string | null;
};

export type BriefingInput = {
  displayName: string;
  appointmentsToday: AppointmentWithCustomer[];
  overdueTasksCount: number;
  tasksDueTodayCount: number;
  overdueTasks: TaskWithCustomer[];
  tasksDueToday: TaskWithCustomer[];
  inactiveCustomers: InactiveCustomer[];
  customersAddedThisWeek: number;
  appointmentsThisWeek: number;
  totalCustomers: number;
};

export type BriefingBullet = {
  text: string;
  href?: string;
};

export type DailyBriefing = {
  greeting: string;
  intro: string;
  bullets: BriefingBullet[];
  highestPriority: BriefingBullet | null;
  suggestions: string[];
  isQuietDay: boolean;
};
