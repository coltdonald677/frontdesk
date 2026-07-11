import { notFound } from "next/navigation";
import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { InvoiceDetailClient } from "@/app/components/invoices/invoice-detail-client";
import { InvoiceForm } from "@/app/components/invoices/invoice-form";
import { getBusinessProfile } from "@/lib/business-profile";
import { getCustomers } from "@/lib/customers";
import { getInvoiceById } from "@/lib/invoices";
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

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: InvoiceDetailPageProps) {
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const invoice = await getInvoiceById(profile!.id, id);

  if (!invoice) {
    notFound();
  }

  const { displayName, initials } = getUserDisplay(user!);
  const showEdit = edit === "1";

  const customers =
    showEdit || invoice.status === "draft"
      ? await getCustomers(profile!.id)
      : [];

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-6xl">
        {showEdit && customers.length > 0 ? (
          <InvoiceForm customers={customers} invoice={invoice} />
        ) : (
          <InvoiceDetailClient invoice={invoice} businessProfile={profile!} />
        )}
      </div>
    </DashboardShell>
  );
}
