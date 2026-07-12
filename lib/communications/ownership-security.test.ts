import { describe, expect, it, vi } from "vitest";
import {
  verifyCommunicationBelongsToCustomer,
  verifyEmployeeBelongsToBusiness,
} from "@/lib/communications/ownership-security";

const BUSINESS_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BUSINESS_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CUSTOMER_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const COMM_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const EMPLOYEE_B = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

type Row = Record<string, unknown> | null;

function mockSupabase(tableRows: Record<string, Row>) {
  return {
    from: vi.fn((table: string) => {
      const chain = {
        _filters: [] as Array<{ col: string; val: unknown }>,
        select: vi.fn(function (this: typeof chain) {
          return this;
        }),
        eq: vi.fn(function (this: typeof chain, col: string, val: unknown) {
          this._filters.push({ col, val });
          return this;
        }),
        maybeSingle: vi.fn(async function (this: typeof chain) {
          const row = tableRows[table];
          if (!row) return { data: null };

          const matches = this._filters.every((f) => row[f.col] === f.val);
          return { data: matches ? row : null };
        }),
      };
      return chain;
    }),
  } as unknown as Parameters<typeof verifyEmployeeBelongsToBusiness>[0];
}

describe("communication ownership (F-007, F-008)", () => {
  it("rejects Business B employee for Business A", async () => {
    const supabase = mockSupabase({
      employees: {
        id: EMPLOYEE_B,
        business_profile_id: BUSINESS_B,
      },
    });

    const result = await verifyEmployeeBelongsToBusiness(
      supabase,
      BUSINESS_A,
      EMPLOYEE_B,
    );

    expect(result).toEqual({ ok: false, error: "Employee not found." });
  });

  it("accepts employee belonging to same business", async () => {
    const supabase = mockSupabase({
      employees: {
        id: EMPLOYEE_B,
        business_profile_id: BUSINESS_A,
      },
    });

    const result = await verifyEmployeeBelongsToBusiness(
      supabase,
      BUSINESS_A,
      EMPLOYEE_B,
    );

    expect(result).toEqual({ ok: true });
  });

  it("rejects communication from another customer", async () => {
    const supabase = mockSupabase({
      customer_communications: {
        id: COMM_B,
        customer_id: "other-customer",
        business_profile_id: BUSINESS_A,
      },
    });

    const result = await verifyCommunicationBelongsToCustomer(
      supabase,
      BUSINESS_A,
      CUSTOMER_A,
      COMM_B,
    );

    expect(result).toEqual({ ok: false, error: "Communication not found." });
  });

  it("rejects cross-tenant communication on attachment upload", async () => {
    const supabase = mockSupabase({
      customer_communications: {
        id: COMM_B,
        customer_id: CUSTOMER_A,
        business_profile_id: BUSINESS_B,
      },
    });

    const result = await verifyCommunicationBelongsToCustomer(
      supabase,
      BUSINESS_A,
      CUSTOMER_A,
      COMM_B,
    );

    expect(result).toEqual({ ok: false, error: "Communication not found." });
  });

  it("accepts communication belonging to customer and business", async () => {
    const supabase = mockSupabase({
      customer_communications: {
        id: COMM_B,
        customer_id: CUSTOMER_A,
        business_profile_id: BUSINESS_A,
      },
    });

    const result = await verifyCommunicationBelongsToCustomer(
      supabase,
      BUSINESS_A,
      CUSTOMER_A,
      COMM_B,
    );

    expect(result).toEqual({ ok: true });
  });
});
