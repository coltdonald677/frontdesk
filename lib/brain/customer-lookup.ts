import "server-only";

import { getCustomers } from "@/lib/customers";
import type { Customer } from "@/lib/customers/types";
import type { CustomerDirectoryEntry } from "./entity-resolution";
import { resolveCustomerReferenceFromList } from "./entity-resolution";

export function customersToDirectory(customers: Customer[]): CustomerDirectoryEntry[] {
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    company: customer.company,
  }));
}

export async function loadBusinessCustomerDirectory(
  businessProfileId: string,
): Promise<CustomerDirectoryEntry[]> {
  const customers = await getCustomers(businessProfileId);
  return customersToDirectory(customers);
}

export async function lookupCustomerReferenceLive(
  businessProfileId: string,
  reference: string,
) {
  const directory = await loadBusinessCustomerDirectory(businessProfileId);
  return resolveCustomerReferenceFromList(reference, directory);
}
