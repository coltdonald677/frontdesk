"use client";

import {
  formatTimeDisplay,
  formatTimeRange,
} from "@/lib/appointments/datetime";
import {
  STATUS_CARD_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  STATUS_TIME_STYLES,
  type AppointmentWithCustomer,
} from "@/lib/appointments/types";
import { CustomerAvatar } from "./customer-avatar";
import { AssignedEmployeeLabel } from "@/app/components/employees/assigned-employee-label";

type AppointmentCardVariant = "default" | "compact" | "month";

type AppointmentCardProps = {
  appointment: AppointmentWithCustomer;
  onSelect: (appointment: AppointmentWithCustomer) => void;
  variant?: AppointmentCardVariant;
  /** @deprecated Use variant="compact" instead */
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (
    event: React.DragEvent<HTMLButtonElement>,
    appointment: AppointmentWithCustomer,
  ) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
};

function getCustomerLabel(
  name?: string | null,
  company?: string | null,
) {
  if (company?.trim()) {
    return company.trim();
  }
  if (name?.trim()) {
    return name.trim();
  }
  return null;
}

export function AppointmentCard({
  appointment,
  onSelect,
  variant,
  compact = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
}: AppointmentCardProps) {
  const resolvedVariant: AppointmentCardVariant =
    variant ?? (compact ? "compact" : "default");
  const customerName = appointment.customers?.name;
  const customerCompany = appointment.customers?.company;
  const customerLabel = getCustomerLabel(customerName, customerCompany);

  const dragClasses = isDragging
    ? "cursor-grabbing opacity-50"
    : draggable
      ? "cursor-grab active:cursor-grabbing"
      : "cursor-pointer";

  if (resolvedVariant === "month") {
    return (
      <button
        type="button"
        draggable={draggable}
        onDragStart={
          draggable && onDragStart
            ? (event) => onDragStart(event, appointment)
            : undefined
        }
        onDragEnd={onDragEnd}
        onClick={() => onSelect(appointment)}
        className={`block w-full shrink-0 overflow-hidden rounded border px-1.5 py-1 text-left transition-all ${STATUS_CARD_STYLES[appointment.status]} hover:brightness-110 ${dragClasses}`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={`shrink-0 text-[10px] font-semibold leading-none ${STATUS_TIME_STYLES[appointment.status]}`}
          >
            {formatTimeDisplay(appointment.start_time)}
          </span>
          <span className="min-w-0 truncate text-[10px] font-medium leading-tight text-white">
            {appointment.title}
          </span>
        </div>
        {customerLabel && (
          <p className="mt-0.5 truncate text-[10px] leading-tight text-zinc-500">
            {customerLabel}
          </p>
        )}
        <AssignedEmployeeLabel
          employee={appointment.employees}
          size="xs"
          className="mt-0.5"
        />
      </button>
    );
  }

  const isCompact = resolvedVariant === "compact";

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={
        draggable && onDragStart
          ? (event) => onDragStart(event, appointment)
          : undefined
      }
      onDragEnd={onDragEnd}
      onClick={() => onSelect(appointment)}
      className={`flex w-full items-start gap-2 rounded-lg border text-left transition-all ${STATUS_CARD_STYLES[appointment.status]} hover:brightness-110 ${
        isCompact ? "px-2.5 py-2" : "px-4 py-3"
      } ${dragClasses}`}
    >
      <CustomerAvatar
        name={customerName}
        company={customerCompany}
        size={isCompact ? "sm" : "md"}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className={`min-w-0 truncate font-medium text-white ${isCompact ? "text-xs" : "text-sm"}`}
          >
            {appointment.title}
          </p>
          {!isCompact && (
            <span
              className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[appointment.status]}`}
            >
              {STATUS_LABELS[appointment.status]}
            </span>
          )}
        </div>
        <p
          className={`mt-1 truncate ${STATUS_TIME_STYLES[appointment.status]} ${isCompact ? "text-[11px]" : "text-xs"}`}
        >
          {formatTimeRange(appointment.start_time, appointment.end_time)}
        </p>
        {customerName && (
          <p
            className={`mt-1 truncate text-zinc-400 ${isCompact ? "text-[11px]" : "text-xs"}`}
          >
            {customerName}
            {customerCompany ? ` · ${customerCompany}` : ""}
          </p>
        )}
        <AssignedEmployeeLabel
          employee={appointment.employees}
          size={isCompact ? "xs" : "sm"}
          className={customerName ? "mt-1.5" : "mt-1"}
        />
        {!isCompact && appointment.notes && (
          <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
            {appointment.notes}
          </p>
        )}
      </div>
    </button>
  );
}
