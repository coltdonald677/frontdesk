export const APPOINTMENT_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type Appointment = {
  id: string;
  business_profile_id: string;
  customer_id: string;
  title: string;
  notes: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
};

export type AppointmentWithCustomer = Appointment & {
  customers: { name: string; company: string | null } | null;
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const STATUS_CARD_STYLES: Record<AppointmentStatus, string> = {
  scheduled:
    "border-blue-500/25 bg-blue-500/10 hover:border-blue-500/40 hover:bg-blue-500/15",
  completed:
    "border-emerald-500/25 bg-emerald-500/10 hover:border-emerald-500/40 hover:bg-emerald-500/15",
  cancelled:
    "border-zinc-500/25 bg-zinc-500/10 hover:border-zinc-500/40 hover:bg-zinc-500/15",
};

export const STATUS_TIME_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "text-blue-300",
  completed: "text-emerald-300",
  cancelled: "text-zinc-400",
};

export type AppointmentStatusFilter = "all" | AppointmentStatus;
