import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { InvoiceForm } from "@/app/components/invoices/invoice-form";
import { InvoicesClient } from "@/app/components/invoices/invoices-client";
import { getBusinessProfile } from "@/lib/business-profile";
import { getCustomers } from "@/lib/customers";
import { parseInvoiceFilter } from "@/lib/dashboard/links";
import {
  buildInvoiceDraftFromAppointment,
  getActiveInvoiceForAppointment,
  getInvoices,
} from "@/lib/invoices";
import { getInvoiceDefaultsForBusiness } from "@/lib/business-settings";
import type { PaymentTerm } from "@/lib/invoices/invoice-dates";
import { createClient } from "@/lib/supabase/server";

function getUserDisplay(user: {
  email?: string;
  user_metadata?: { full_name?: string };
}) {
  const fullName = user.user_metadata?.full_name as string | undefined;
  const firstName = fullName?.split(" ")[0];
  const emailName = user.email?.split("@")[0];
  const displayName = firstName || emailName || "there";
  const initials = (firstName?.[0] || emailName?.[0] || "U").toUpperCase();
  return { displayName, initials };
}

type InvoicesPageProps = {
  searchParams: Promise<{
    filter?: string;
    search?: string;
    new?: string;
    customer?: string;
    appointment?: string;
  }>;
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const initialFilter = parseInvoiceFilter(params.filter);
  const initialSearch = params.search ?? "";
  const showNewForm = params.new === "invoice";
  const prefillCustomerId = params.customer;
  const prefillAppointmentId = params.appointment;

  const [invoices, customers, invoiceDefaults] = await Promise.all([
    getInvoices(profile!.id, {
      filter: initialFilter,
      search: initialSearch,
    }),
    showNewForm || prefillAppointmentId || prefillCustomerId
      ? getCustomers(profile!.id)
      : Promise.resolve([]),
    showNewForm || prefillAppointmentId || prefillCustomerId
      ? getInvoiceDefaultsForBusiness(profile!.id)
      : Promise.resolve(null),
  ]);

  let initialDraft;
  let appointmentContext;
  let duplicateWarning: string | undefined;

  if (prefillAppointmentId) {
    const existing = await getActiveInvoiceForAppointment(
      profile!.id,
      prefillAppointmentId,
    );
    if (existing) {
      duplicateWarning = `Invoice ${existing.invoice_number} already exists for this appointment.`;
    } else {
      const draftResult = await buildInvoiceDraftFromAppointment(
        profile!.id,
        prefillAppointmentId,
      );
      if (draftResult) {
        initialDraft = draftResult.input;
        appointmentContext = draftResult.appointment;
      }
    }
  } else if (prefillCustomerId) {
    initialDraft = {
      customer_id: prefillCustomerId,
      issue_date: new Date().toISOString().slice(0, 10),
      line_items: [
        {
          description: "",
          quantity: 1,
          unit_price: 0,
          tax_rate: 0,
        },
      ],
    };
  }

  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Invoices
          </h1>
          <p className="mt-2 text-zinc-400">
            Create, send, and track invoices for {profile!.business_name}.
          </p>
        </div>

        {(showNewForm || prefillAppointmentId || prefillCustomerId) && customers.length > 0 && (
          <div className="mb-8 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5 sm:p-6">
            <InvoiceForm
              customers={customers}
              initialDraft={initialDraft ?? undefined}
              appointmentContext={appointmentContext}
              duplicateWarning={duplicateWarning}
              invoiceDefaults={
                invoiceDefaults
                  ? {
                      defaultPaymentTerm: invoiceDefaults.defaultPaymentTerm as PaymentTerm,
                      defaultTaxRate: invoiceDefaults.defaultTaxRate,
                      defaultCustomerMessage: invoiceDefaults.defaultCustomerMessage,
                      defaultInternalNotes: invoiceDefaults.defaultInternalNotes,
                    }
                  : undefined
              }
            />
          </div>
        )}

        <InvoicesClient
          invoices={invoices}
          initialFilter={initialFilter}
          initialSearch={initialSearch}
          openNewInvoice={showNewForm}
        />
      </div>
    </DashboardShell>
  );
}
