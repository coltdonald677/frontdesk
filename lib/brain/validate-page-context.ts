import "server-only";

import { assertEntityBelongsToBusiness } from "@/lib/brain/permissions";
import {
  normalizeBrainPageContextHint,
  type BrainPageContextHint,
  type ValidatedBrainPageContext,
} from "@/lib/brain/page-context";

export type ValidatePageContextResult =
  | { ok: true; context: ValidatedBrainPageContext | null }
  | { ok: false; error: string };

/**
 * Revalidate page context hints server-side before Brain uses them.
 * Rejects cross-tenant entity references.
 */
export async function validateBrainPageContext(
  businessProfileId: string,
  hint: BrainPageContextHint | null | undefined,
): Promise<ValidatePageContextResult> {
  const normalized = normalizeBrainPageContextHint(hint);
  if (!normalized) {
    return { ok: true, context: null };
  }

  const checks: Array<{ entityType: string; entityId: string | undefined }> = [
    { entityType: "customer", entityId: normalized.customerId },
    { entityType: "invoice", entityId: normalized.invoiceId },
    { entityType: "appointment", entityId: normalized.appointmentId },
    { entityType: "employee", entityId: normalized.employeeId },
    { entityType: "task", entityId: normalized.taskId },
  ];

  for (const check of checks) {
    if (!check.entityId) continue;
    const ownership = await assertEntityBelongsToBusiness(
      businessProfileId,
      check.entityType,
      check.entityId,
    );
    if (!ownership.ok) {
      return { ok: false, error: ownership.error };
    }
  }

  return { ok: true, context: normalized };
}
