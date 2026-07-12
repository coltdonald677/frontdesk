import { notFound } from "next/navigation";
import { InvoicePublicView } from "@/app/components/invoices/invoice-public-view";
import {
  fetchPublicInvoiceByToken,
  recordPublicInvoiceOpen,
} from "@/lib/invoices/delivery-service";
import { isValidDeliveryTokenFormat } from "@/lib/invoices/delivery-token";

type PublicInvoicePageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicInvoicePage({ params }: PublicInvoicePageProps) {
  const { token } = await params;

  if (!isValidDeliveryTokenFormat(token)) {
    notFound();
  }

  const invoice = await fetchPublicInvoiceByToken(token);
  if (!invoice) {
    notFound();
  }

  await recordPublicInvoiceOpen(token);

  return <InvoicePublicView invoice={invoice} />;
}
