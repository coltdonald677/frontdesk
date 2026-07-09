export type GlobalSearchResultType = "customer" | "task" | "appointment";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  name: string;
  subtitle: string;
  href: string;
};

export type GlobalSearchResults = {
  customers: GlobalSearchResult[];
  tasks: GlobalSearchResult[];
  appointments: GlobalSearchResult[];
};

export const EMPTY_GLOBAL_SEARCH_RESULTS: GlobalSearchResults = {
  customers: [],
  tasks: [],
  appointments: [],
};

export function flattenGlobalSearchResults(results: GlobalSearchResults) {
  return [
    ...results.customers,
    ...results.tasks,
    ...results.appointments,
  ];
}

export function hasGlobalSearchResults(results: GlobalSearchResults) {
  return (
    results.customers.length > 0 ||
    results.tasks.length > 0 ||
    results.appointments.length > 0
  );
}
