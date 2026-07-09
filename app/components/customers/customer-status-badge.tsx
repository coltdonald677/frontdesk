import type { CustomerStatus } from "@/lib/customers/status";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_STYLES,
} from "@/lib/customers/status";

type CustomerStatusBadgeProps = {
  status: CustomerStatus;
};

export function CustomerStatusBadge({ status }: CustomerStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${CUSTOMER_STATUS_STYLES[status]}`}
    >
      {CUSTOMER_STATUS_LABELS[status]}
    </span>
  );
}
