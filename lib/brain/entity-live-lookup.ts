import "server-only";

import { addDaysToIsoDate } from "@/lib/appointments/datetime";
import { getInvoices } from "@/lib/invoices/service";
import { getScheduleEntriesByDateRange } from "@/lib/schedule-entries/service";
import type { StoredScheduleEntryType } from "@/lib/schedule-entries/types";
import { assertEntityBelongsToBusiness } from "./permissions";
import type { EntitySuggestionType } from "./pending-entity-clarification";

export const LIVE_LOOKUP_DEFAULT_LIMIT = 50;

export type InvoiceLookupRecord = {
  id: string;
  number: string;
  customer: string;
  status: string;
  balanceDue: number;
  totalAmount: number;
};

export type ScheduleEntryLookupRecord = {
  id: string;
  title: string;
  entryType: StoredScheduleEntryType;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  employeeName: string | null;
  employeeId: string | null;
  customerName: string | null;
  siteLocation: string | null;
};

export type EntityLiveLookupCache = {
  invoices?: InvoiceLookupRecord[];
  scheduleEntries?: ScheduleEntryLookupRecord[];
};

function formatEntryTypeLabel(entryType: StoredScheduleEntryType): string {
  return entryType.replace(/_/g, " ");
}

export function mapInvoiceToLookupRecord(invoice: {
  id: string;
  invoice_number: string;
  status: string;
  balance_due: number;
  total_amount: number;
  customers: { name: string; company: string | null } | null;
}): InvoiceLookupRecord {
  return {
    id: invoice.id,
    number: invoice.invoice_number,
    customer: invoice.customers?.company || invoice.customers?.name || "Customer",
    status: invoice.status,
    balanceDue: invoice.balance_due,
    totalAmount: invoice.total_amount,
  };
}

export function mapScheduleEntryToLookupRecord(entry: {
  id: string;
  entry_type: StoredScheduleEntryType;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  site_location: string | null;
  employees: Array<{ id: string; full_name: string }>;
  customers?: { name: string; company: string | null } | null;
}): ScheduleEntryLookupRecord {
  const primaryEmployee = entry.employees[0] ?? null;
  const customerName = entry.customers
    ? entry.customers.company || entry.customers.name
    : null;

  return {
    id: entry.id,
    title: entry.title || formatEntryTypeLabel(entry.entry_type),
    entryType: entry.entry_type,
    startDate: entry.start_date,
    endDate: entry.end_date,
    startTime: entry.start_time,
    endTime: entry.end_time,
    employeeName: primaryEmployee?.full_name ?? null,
    employeeId: primaryEmployee?.id ?? null,
    customerName,
    siteLocation: entry.site_location,
  };
}

/**
 * Tenant-scoped live invoice directory for fuzzy matching.
 * Results are limited and ranked client-side after this fetch.
 */
export async function loadInvoiceLookupDirectory(
  businessProfileId: string,
  options?: { limit?: number },
): Promise<InvoiceLookupRecord[]> {
  const limit = options?.limit ?? LIVE_LOOKUP_DEFAULT_LIMIT;
  const invoices = await getInvoices(businessProfileId, { limit });
  return invoices.map(mapInvoiceToLookupRecord);
}

/**
 * Tenant-scoped live schedule-entry directory for fuzzy matching.
 * Defaults to a rolling window around today when dates are omitted.
 */
export async function loadScheduleEntryLookupDirectory(
  businessProfileId: string,
  options?: { startDate?: string; endDate?: string; limit?: number },
): Promise<ScheduleEntryLookupRecord[]> {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = options?.startDate ?? addDaysToIsoDate(today, -30);
  const endDate = options?.endDate ?? addDaysToIsoDate(today, 90);
  const limit = options?.limit ?? LIVE_LOOKUP_DEFAULT_LIMIT;

  const entries = await getScheduleEntriesByDateRange(
    businessProfileId,
    startDate,
    endDate,
  );

  return entries
    .filter((entry) => entry.status === "scheduled")
    .slice(0, limit)
    .map(mapScheduleEntryToLookupRecord);
}

export async function loadEntityLiveLookupCache(
  businessProfileId: string,
  entityTypes: EntitySuggestionType[],
): Promise<EntityLiveLookupCache> {
  const cache: EntityLiveLookupCache = {};

  if (entityTypes.includes("invoice")) {
    cache.invoices = await loadInvoiceLookupDirectory(businessProfileId);
  }

  if (entityTypes.includes("schedule_entry")) {
    cache.scheduleEntries = await loadScheduleEntryLookupDirectory(businessProfileId);
  }

  return cache;
}

export async function verifyLiveEntityOwnership(
  businessProfileId: string,
  entityType: EntitySuggestionType,
  entityId: string,
): Promise<boolean> {
  const ownership = await assertEntityBelongsToBusiness(
    businessProfileId,
    entityType,
    entityId,
  );
  return ownership.ok;
}
