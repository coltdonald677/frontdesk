export const CUSTOMER_ACTIVITY_TYPES = [
  "note",
  "call",
  "email",
  "meeting",
  "follow_up",
] as const;

export type CustomerActivityType = (typeof CUSTOMER_ACTIVITY_TYPES)[number];

export type CustomerActivity = {
  id: string;
  customer_id: string;
  business_profile_id: string;
  activity_type: CustomerActivityType;
  content: string;
  created_at: string;
};

export type CustomerActivityWithCustomer = CustomerActivity & {
  customers: { name: string } | null;
};

export const ACTIVITY_TYPE_LABELS: Record<CustomerActivityType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  follow_up: "Follow-up",
};
