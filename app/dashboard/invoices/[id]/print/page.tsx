import { notFound } from "next/navigation";
import { InvoicePrintLayout } from "@/app/components/invoices/invoice-print-layout";
import { getBusinessProfile } from "@/lib/business-profile";
import { getInvoiceById } from "@/lib/invoices";

type InvoicePrintPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoicePrintPage({ params }: InvoicePrintPageProps) {
  const { id } = await params;
  const profile = await getBusinessProfile();
  const invoice = await getInvoiceById(profile!.id, id);

  if (!invoice) {
    notFound();
  }

  return (
    <InvoicePrintLayout invoice={invoice} businessProfile={profile!} />
  );
}
