import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { CustomersClient } from "@/app/components/customers/customers-client";
import { getBusinessProfile } from "@/lib/business-profile";
import { parseCustomerFilter } from "@/lib/dashboard/links";
import { getCustomers, getInactiveCustomers } from "@/lib/customers";
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

type CustomersPageProps = {
  searchParams: Promise<{ filter?: string; new?: string }>;
};

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const initialFilter = parseCustomerFilter(params.filter);
  const openNewCustomer = params.new === "customer";

  const [customers, inactiveCustomers] = await Promise.all([
    getCustomers(profile!.id),
    initialFilter === "inactive"
      ? getInactiveCustomers(profile!.id)
      : Promise.resolve([]),
  ]);
  const inactiveCustomerIds =
    initialFilter === "inactive"
      ? inactiveCustomers.map((customer) => customer.id)
      : undefined;
  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Customers
          </h1>
          <p className="mt-2 text-zinc-400">
            Manage your customer relationships for {profile!.business_name}.
          </p>
        </div>

        <CustomersClient
          customers={customers}
          initialFilter={initialFilter}
          inactiveCustomerIds={inactiveCustomerIds}
          openNewCustomer={openNewCustomer}
        />
      </div>
    </DashboardShell>
  );
}
