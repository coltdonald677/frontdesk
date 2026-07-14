import { parseWriteIntent } from "./write-intent-parser";
import {
  entityBelongsToBusinessContext,
  mergeResolvedOverride,
  resolveAppointmentForWriteIntent,
  resolveCustomerForWriteIntent,
  resolveEmployeeForWriteIntent,
  resolveInvoiceForWriteIntent,
  resolveScheduleEntryForWriteIntent,
  resumePendingEntityClarification,
} from "./entity-suggestion-service";
import {
  formatCustomerDisplay,
  listSchedulableAppointments,
} from "./entity-resolution";
import { loadEntityLiveLookupCache } from "./entity-live-lookup";
import {
  buildNoneOfTheseQuestion,
  isPendingEntityClarificationStale,
  type EntitySuggestionType,
  type PendingEntityClarification,
  type ResolvedEntityOverride,
} from "./pending-entity-clarification";
import type { BrainContextSnapshot, WriteIntentParseOptions, WriteIntentResult } from "./types";

async function loadLiveLookupForEntityType(
  businessProfileId: string,
  entityType: EntitySuggestionType,
) {
  if (entityType !== "invoice" && entityType !== "schedule_entry") {
    return undefined;
  }
  return loadEntityLiveLookupCache(businessProfileId, [entityType]);
}

export async function continueAfterEntitySuggestionSelection(input: {
  context: BrainContextSnapshot;
  pending: PendingEntityClarification;
  selectedEntityId: string;
  selectedLabel: string;
  selectedEntityType: EntitySuggestionType;
  pageContext?: WriteIntentParseOptions["pageContext"];
}): Promise<WriteIntentResult> {
  if (isPendingEntityClarificationStale(input.pending)) {
    return {
      kind: "clarification",
      question:
        "That clarification expired. Please repeat your original request.",
    };
  }

  const liveLookup = await loadLiveLookupForEntityType(
    input.context.businessProfileId,
    input.selectedEntityType,
  );

  if (
    !entityBelongsToBusinessContext(
      input.context,
      input.selectedEntityType,
      input.selectedEntityId,
      liveLookup,
    )
  ) {
    return {
      kind: "clarification",
      question:
        "That record is no longer available in your business. Please try again.",
    };
  }

  const updatedPending = resumePendingEntityClarification({
    pending: input.pending,
    selectedEntityId: input.selectedEntityId,
    selectedLabel: input.selectedLabel,
    selectedEntityType: input.selectedEntityType,
  });

  return parseWriteIntent(input.pending.originalQuestion, input.context, {
    originalQuestion: input.pending.originalQuestion,
    resolvedEntityOverrides: updatedPending.resolvedOverrides,
    pendingCreateAppointment: updatedPending.pendingCreateAppointment ?? undefined,
    pendingMultiDayAssignment: updatedPending.pendingMultiDayAssignment ?? undefined,
    pageContext: input.pageContext,
    liveInvoiceDirectory: liveLookup?.invoices,
    liveScheduleEntryDirectory: liveLookup?.scheduleEntries,
  });
}

export async function retryManualEntityEntry(
  retryPhrase: string,
  pending: PendingEntityClarification,
  context: BrainContextSnapshot,
  options?: WriteIntentParseOptions,
): Promise<WriteIntentResult> {
  const trimmed = retryPhrase.trim();
  if (!trimmed) {
    return {
      kind: "clarification",
      question: buildNoneOfTheseQuestion(pending.unresolvedField),
      pendingEntityClarification: pending,
    };
  }

  if (/^cancel(?:\s+this\s+request)?$/i.test(trimmed)) {
    return { kind: "none" };
  }

  const writeOptions: WriteIntentParseOptions = {
    ...options,
    originalQuestion: pending.originalQuestion,
    resolvedEntityOverrides: pending.resolvedOverrides,
    pendingCreateAppointment: pending.pendingCreateAppointment ?? undefined,
    pendingMultiDayAssignment: pending.pendingMultiDayAssignment ?? undefined,
    pageContext: options?.pageContext,
    liveInvoiceDirectory: options?.liveInvoiceDirectory,
    liveScheduleEntryDirectory: options?.liveScheduleEntryDirectory,
  };

  let resolvedOverride: ResolvedEntityOverride | null = null;

  switch (pending.unresolvedField) {
    case "customer": {
      const outcome = resolveCustomerForWriteIntent(trimmed, context, writeOptions);
      if (outcome.status === "needs_clarification") return outcome.result;
      resolvedOverride = {
        field: "customer",
        entityId: outcome.entity.id,
        displayName: formatCustomerDisplay(outcome.entity),
      };
      break;
    }
    case "employee": {
      const outcome = resolveEmployeeForWriteIntent(trimmed, context, writeOptions);
      if (outcome.status === "needs_clarification") return outcome.result;
      resolvedOverride = {
        field: "employee",
        entityId: outcome.entity.id,
        displayName: outcome.entity.name,
      };
      break;
    }
    case "appointment": {
      const outcome = resolveAppointmentForWriteIntent(
        trimmed,
        listSchedulableAppointments(context),
        writeOptions,
      );
      if (outcome.status === "needs_clarification") return outcome.result;
      resolvedOverride = {
        field: "appointment",
        entityId: outcome.entity.id,
        displayName: outcome.entity.title || outcome.entity.customer,
      };
      break;
    }
    case "invoice": {
      const invoices = options?.liveInvoiceDirectory ?? [];
      const outcome = resolveInvoiceForWriteIntent(trimmed, invoices, writeOptions);
      if (outcome.status === "needs_clarification") return outcome.result;
      resolvedOverride = {
        field: "invoice",
        entityId: outcome.entity.id,
        displayName: `Invoice ${outcome.entity.number}`,
      };
      break;
    }
    case "schedule_entry": {
      const entries = options?.liveScheduleEntryDirectory ?? [];
      const outcome = resolveScheduleEntryForWriteIntent(trimmed, entries, writeOptions);
      if (outcome.status === "needs_clarification") return outcome.result;
      resolvedOverride = {
        field: "schedule_entry",
        entityId: outcome.entity.id,
        displayName: outcome.entity.title,
      };
      break;
    }
    default:
      return parseWriteIntent(pending.originalQuestion, context, {
        ...writeOptions,
        pendingEntityClarification: {
          ...pending,
          awaitingManualEntry: false,
        },
      });
  }

  const mergedOverrides = mergeResolvedOverride(
    pending.resolvedOverrides,
    resolvedOverride,
  );

  return parseWriteIntent(pending.originalQuestion, context, {
    ...writeOptions,
    resolvedEntityOverrides: mergedOverrides,
    pendingEntityClarification: {
      ...pending,
      awaitingManualEntry: false,
      resolvedOverrides: mergedOverrides,
    },
  });
}
