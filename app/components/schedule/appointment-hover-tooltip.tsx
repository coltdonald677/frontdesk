"use client";

import { createPortal } from "react-dom";
import {
  formatTimeRange,
} from "@/lib/appointments/datetime";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  STATUS_TIME_STYLES,
  type AppointmentWithCustomer,
} from "@/lib/appointments/types";
import { normalizeAssignedEmployee } from "@/app/components/employees/assigned-employee-label";

const TOOLTIP_WIDTH = 264;
const VIEWPORT_PADDING = 8;

type AppointmentHoverTooltipProps = {
  appointment: AppointmentWithCustomer;
  anchorRect: DOMRect | null;
  visible: boolean;
};

function getTooltipPosition(anchorRect: DOMRect) {
  const spaceRight = window.innerWidth - anchorRect.right;
  const spaceLeft = anchorRect.left;
  const estimatedHeight = 200;

  let left: number;
  let top = anchorRect.top;
  let placement: "right" | "left" | "below" = "right";

  if (spaceRight >= TOOLTIP_WIDTH + VIEWPORT_PADDING) {
    left = anchorRect.right + 8;
  } else if (spaceLeft >= TOOLTIP_WIDTH + VIEWPORT_PADDING) {
    left = anchorRect.left - TOOLTIP_WIDTH - 8;
    placement = "left";
  } else {
    left = anchorRect.left + anchorRect.width / 2 - TOOLTIP_WIDTH / 2;
    top = anchorRect.bottom + 8;
    placement = "below";
  }

  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING),
  );

  if (placement !== "below") {
    top = Math.max(
      VIEWPORT_PADDING,
      Math.min(top, window.innerHeight - estimatedHeight - VIEWPORT_PADDING),
    );
  } else {
    top = Math.min(top, window.innerHeight - estimatedHeight - VIEWPORT_PADDING);
  }

  return { left, top, placement };
}

function getCustomerDisplay(appointment: AppointmentWithCustomer) {
  const name = appointment.customers?.name?.trim();
  const company = appointment.customers?.company?.trim();

  if (name && company) {
    return `${name} · ${company}`;
  }
  if (name) {
    return name;
  }
  if (company) {
    return company;
  }
  return "No customer";
}

export function AppointmentHoverTooltip({
  appointment,
  anchorRect,
  visible,
}: AppointmentHoverTooltipProps) {
  if (!visible || !anchorRect || typeof document === "undefined") {
    return null;
  }

  const assignedEmployee = normalizeAssignedEmployee(appointment.employees);
  const { left, top } = getTooltipPosition(anchorRect);

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left,
        top,
        width: TOOLTIP_WIDTH,
        zIndex: 60,
      }}
      className="pointer-events-none rounded-lg border border-white/[0.1] bg-zinc-900/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-sm"
    >
      <p className="text-sm font-semibold leading-snug text-white">
        {appointment.title}
      </p>

      <dl className="mt-2.5 space-y-1.5 text-xs">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Customer
          </dt>
          <dd className="mt-0.5 text-zinc-300">{getCustomerDisplay(appointment)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Assigned to
          </dt>
          <dd className="mt-0.5 text-zinc-300">
            {assignedEmployee?.full_name ?? "Unassigned"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Time
          </dt>
          <dd
            className={`mt-0.5 font-medium ${STATUS_TIME_STYLES[appointment.status]}`}
          >
            {formatTimeRange(appointment.start_time, appointment.end_time)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Status
          </dt>
          <dd className="mt-1">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[appointment.status]}`}
            >
              {STATUS_LABELS[appointment.status]}
            </span>
          </dd>
        </div>
        {appointment.notes?.trim() && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Notes
            </dt>
            <dd className="mt-0.5 line-clamp-3 text-zinc-400">
              {appointment.notes.trim()}
            </dd>
          </div>
        )}
      </dl>
    </div>,
    document.body,
  );
}
