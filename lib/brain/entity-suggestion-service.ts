import {
  dedupeScoredCandidates,
  FUZZY_MIN_SUGGESTION_SCORE,
  rankFuzzyMatches,
  type ScoredCandidate,
} from "./fuzzy-match";
import {
  applyEntitySuggestionSelection,
  assertSuggestionLabelsSafe,
  buildEntityClarificationQuestion,
  buildNoneOfTheseQuestion,
  buildNoReliableMatchMessage,
  createPendingEntityClarification,
  dedupeEntitySuggestions,
  dismissEntitySuggestions,
  type EntitySuggestion,
  type EntitySuggestionType,
  type PendingEntityClarification,
  type ResolvedEntityOverride,
  sanitizeSuggestionsForClient,
} from "./pending-entity-clarification";
import {
  formatCustomerDisplay,
  listSchedulableAppointments,
  normalizeEntityName,
  type BrainAppointmentRef,
  type CustomerDirectoryEntry,
  type EmployeeEntity,
  type EntityMatch,
} from "./entity-resolution";
import type {
  BrainContextSnapshot,
  CreateAppointmentPendingIntent,
  MultiDayAssignmentPendingIntent,
  WriteIntentParseOptions,
  WriteIntentResult,
} from "./types";
import type { ValidatedBrainPageContext } from "./page-context";
import type {
  EntityLiveLookupCache,
  InvoiceLookupRecord,
  ScheduleEntryLookupRecord,
} from "./entity-live-lookup";

export function getPageContextEntityIdForType(
  pageContext: ValidatedBrainPageContext | null | undefined,
  entityType: EntitySuggestionType,
): string | undefined {
  if (!pageContext) return undefined;
  switch (entityType) {
    case "customer":
      return pageContext.customerId;
    case "employee":
      return pageContext.employeeId;
    case "invoice":
      return pageContext.invoiceId;
    case "appointment":
      return pageContext.appointmentId;
    case "task":
      return pageContext.taskId;
    case "schedule_entry":
      return pageContext.scheduleEntryId;
    default:
      return undefined;
  }
}

export function applyPageContextBoostToSuggestions(
  suggestions: EntitySuggestion[],
  entityType: EntitySuggestionType,
  pageContext: ValidatedBrainPageContext | null | undefined,
): EntitySuggestion[] {
  const pageEntityId = getPageContextEntityIdForType(pageContext, entityType);
  if (!pageEntityId) return suggestions;
  return prioritizePageContextSuggestion(suggestions, pageEntityId);
}

function finalizeSuggestions(
  suggestions: EntitySuggestion[],
  entityType: EntitySuggestionType,
  pageContext?: ValidatedBrainPageContext | null,
): EntitySuggestion[] {
  return applyPageContextBoostToSuggestions(suggestions, entityType, pageContext);
}

export type EntityResolutionWithSuggestions<T> =
  | { kind: "resolved"; entity: T }
  | { kind: "ambiguous"; entities: T[]; suggestions: EntitySuggestion[] }
  | { kind: "suggest"; suggestions: EntitySuggestion[] }
  | { kind: "none" };

function toSuggestions<T extends { id: string }>(
  entityType: EntitySuggestionType,
  scored: ScoredCandidate<T>[],
  buildLabel: (entity: T) => string,
  buildSubtitle?: (entity: T) => string | undefined,
): EntitySuggestion[] {
  return dedupeEntitySuggestions(
    scored.map((item) => ({
      entityType,
      entityId: item.entity.id,
      label: buildLabel(item.entity),
      subtitle: buildSubtitle?.(item.entity),
      score: Math.round(item.score * 100) / 100,
    })),
  );
}

export function buildCustomerSuggestions(
  reference: string,
  customers: CustomerDirectoryEntry[],
): EntitySuggestion[] {
  const scored = dedupeScoredCandidates(
    rankFuzzyMatches(reference, customers, (customer) => {
      const texts = [customer.name];
      if (customer.company) texts.push(customer.company);
      return texts;
    }),
  );

  return toSuggestions("customer", scored, (customer) => formatCustomerDisplay(customer));
}

export function buildEmployeeSuggestions(
  reference: string,
  employees: EmployeeEntity[],
): EntitySuggestion[] {
  const active = employees.filter((employee) => employee.status === "active");
  const scored = dedupeScoredCandidates(
    rankFuzzyMatches(reference, active, (employee) => [employee.name]),
  );

  return toSuggestions(
    "employee",
    scored,
    (employee) => employee.name,
    (employee) => (employee.status === "active" ? "Active" : employee.status),
  );
}

export function buildAppointmentSuggestions(
  reference: string,
  appointments: BrainAppointmentRef[],
): EntitySuggestion[] {
  const scored = dedupeScoredCandidates(
    rankFuzzyMatches(reference, appointments, (appointment) => [
      appointment.title,
      appointment.customer,
      appointment.time,
    ]),
  );

  return toSuggestions(
    "appointment",
    scored,
    (appointment) => appointment.title || appointment.customer,
    (appointment) => {
      const parts = [appointment.date, appointment.time];
      if (appointment.employee) parts.push(appointment.employee);
      return parts.filter(Boolean).join(" · ");
    },
  );
}

export function buildTaskSuggestions(
  reference: string,
  tasks: Array<{ id: string; title: string; customer: string | null }>,
): EntitySuggestion[] {
  const scored = dedupeScoredCandidates(
    rankFuzzyMatches(reference, tasks, (task) => {
      const texts = [task.title];
      if (task.customer) texts.push(task.customer);
      return texts;
    }),
  );

  return toSuggestions(
    "task",
    scored,
    (task) => task.title,
    (task) => task.customer ?? undefined,
  );
}

export function buildInvoiceSuggestions(
  reference: string,
  invoices: InvoiceLookupRecord[],
  options?: { includeTotals?: boolean },
): EntitySuggestion[] {
  const scored = dedupeScoredCandidates(
    rankFuzzyMatches(reference, invoices, (invoice) => [
      invoice.number,
      invoice.customer,
    ]),
  );

  return toSuggestions(
    "invoice",
    scored,
    (invoice) => `Invoice ${invoice.number}`,
    (invoice) => {
      const parts = [invoice.customer, invoice.status];
      if (options?.includeTotals && invoice.totalAmount > 0) {
        parts.push(`$${invoice.totalAmount.toFixed(2)}`);
      }
      return parts.join(" · ");
    },
  );
}

export function buildScheduleEntrySuggestions(
  reference: string,
  entries: ScheduleEntryLookupRecord[],
): EntitySuggestion[] {
  const scored = dedupeScoredCandidates(
    rankFuzzyMatches(reference, entries, (entry) => {
      const texts = [entry.title, entry.entryType.replace(/_/g, " ")];
      if (entry.employeeName) texts.push(entry.employeeName);
      if (entry.customerName) texts.push(entry.customerName);
      if (entry.siteLocation) texts.push(entry.siteLocation);
      return texts;
    }),
  );

  return toSuggestions(
    "schedule_entry",
    scored,
    (entry) => entry.title,
    (entry) => {
      const parts: string[] = [];
      if (entry.employeeName) parts.push(entry.employeeName);
      parts.push(entry.entryType.replace(/_/g, " "));
      parts.push(entry.startDate);
      if (entry.startTime) parts.push(entry.startTime.slice(0, 5));
      if (entry.customerName) parts.push(entry.customerName);
      return parts.join(" · ");
    },
  );
}

function resolveCustomerExactAndPartial(
  reference: string,
  customers: CustomerDirectoryEntry[],
): EntityMatch<CustomerDirectoryEntry> {
  const needle = normalizeEntityName(reference);
  if (!needle) return { kind: "none" };

  const exactName = customers.filter(
    (customer) => normalizeEntityName(customer.name) === needle,
  );
  if (exactName.length === 1) return { kind: "one", entity: exactName[0] };
  if (exactName.length > 1) return { kind: "many", entities: exactName };

  const exactCompany = customers.filter(
    (customer) =>
      customer.company && normalizeEntityName(customer.company) === needle,
  );
  if (exactCompany.length === 1) return { kind: "one", entity: exactCompany[0] };
  if (exactCompany.length > 1) return { kind: "many", entities: exactCompany };

  const partialName = customers.filter((customer) => {
    const normalizedName = normalizeEntityName(customer.name);
    return normalizedName.includes(needle) || needle.includes(normalizedName);
  });
  if (partialName.length === 1) return { kind: "one", entity: partialName[0] };
  if (partialName.length > 1) return { kind: "many", entities: partialName };

  const partialCompany = customers.filter((customer) => {
    if (!customer.company) return false;
    const normalizedCompany = normalizeEntityName(customer.company);
    return normalizedCompany.includes(needle) || needle.includes(normalizedCompany);
  });
  if (partialCompany.length === 1) return { kind: "one", entity: partialCompany[0] };
  if (partialCompany.length > 1) return { kind: "many", entities: partialCompany };

  return { kind: "none" };
}

export function resolveCustomerWithSuggestions(
  reference: string,
  customers: CustomerDirectoryEntry[],
): EntityResolutionWithSuggestions<CustomerDirectoryEntry> {
  const exact = resolveCustomerExactAndPartial(reference, customers);
  if (exact.kind === "one") return { kind: "resolved", entity: exact.entity };
  if (exact.kind === "many") {
    const suggestions = buildCustomerSuggestions(reference, exact.entities);
    return { kind: "ambiguous", entities: exact.entities, suggestions };
  }

  const suggestions = buildCustomerSuggestions(reference, customers).filter(
    (item) => item.score >= FUZZY_MIN_SUGGESTION_SCORE,
  );
  if (suggestions.length > 0) return { kind: "suggest", suggestions };
  return { kind: "none" };
}

export function resolveEmployeeWithSuggestions(
  reference: string,
  employees: EmployeeEntity[],
): EntityResolutionWithSuggestions<EmployeeEntity> {
  const active = employees.filter((employee) => employee.status === "active");
  const needle = normalizeEntityName(reference);
  if (!needle) return { kind: "none" };

  const exact = active.filter(
    (employee) => normalizeEntityName(employee.name) === needle,
  );
  if (exact.length === 1) return { kind: "resolved", entity: exact[0]! };
  if (exact.length > 1) {
    const suggestions = buildEmployeeSuggestions(reference, exact);
    return { kind: "ambiguous", entities: exact, suggestions };
  }

  const partial = active.filter((employee) => {
    const normalized = normalizeEntityName(employee.name);
    return normalized.includes(needle) || needle.includes(normalized);
  });
  if (partial.length === 1) return { kind: "resolved", entity: partial[0]! };
  if (partial.length > 1) {
    const suggestions = buildEmployeeSuggestions(reference, partial);
    return { kind: "ambiguous", entities: partial, suggestions };
  }

  const suggestions = buildEmployeeSuggestions(reference, active).filter(
    (item) => item.score >= FUZZY_MIN_SUGGESTION_SCORE,
  );
  if (suggestions.length > 0) return { kind: "suggest", suggestions };
  return { kind: "none" };
}

export function buildEntityClarificationResult(input: {
  originalQuestion: string;
  reference: string;
  entityType: EntitySuggestionType;
  suggestions: EntitySuggestion[];
  pendingCreateAppointment?: CreateAppointmentPendingIntent | null;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent | null;
  resolvedOverrides?: ResolvedEntityOverride[];
  pageContext?: ValidatedBrainPageContext | null;
}): WriteIntentResult {
  const boosted = finalizeSuggestions(
    input.suggestions,
    input.entityType,
    input.pageContext,
  );
  const safeSuggestions = sanitizeSuggestionsForClient(boosted);
  assertSuggestionLabelsSafe(safeSuggestions);

  const pendingEntityClarification = createPendingEntityClarification({
    originalQuestion: input.originalQuestion,
    unresolvedField: input.entityType,
    reference: input.reference,
    resolvedOverrides: input.resolvedOverrides,
    pendingCreateAppointment: input.pendingCreateAppointment,
    pendingMultiDayAssignment: input.pendingMultiDayAssignment,
  });

  return {
    kind: "clarification",
    question: buildEntityClarificationQuestion(
      input.reference,
      input.entityType,
      safeSuggestions,
    ),
    entitySuggestions: safeSuggestions,
    pendingEntityClarification,
    pendingCreateAppointment: input.pendingCreateAppointment ?? undefined,
    pendingMultiDayAssignment: input.pendingMultiDayAssignment ?? undefined,
  };
}

export function buildNoMatchClarificationResult(input: {
  originalQuestion: string;
  reference: string;
  entityType: EntitySuggestionType;
  pendingCreateAppointment?: CreateAppointmentPendingIntent | null;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent | null;
  resolvedOverrides?: ResolvedEntityOverride[];
}): WriteIntentResult {
  return {
    kind: "clarification",
    question: buildNoReliableMatchMessage(input.reference, input.entityType),
    pendingCreateAppointment: input.pendingCreateAppointment ?? undefined,
    pendingMultiDayAssignment: input.pendingMultiDayAssignment ?? undefined,
    pendingEntityClarification: createPendingEntityClarification({
      originalQuestion: input.originalQuestion,
      unresolvedField: input.entityType,
      reference: input.reference,
      resolvedOverrides: input.resolvedOverrides,
      pendingCreateAppointment: input.pendingCreateAppointment,
      pendingMultiDayAssignment: input.pendingMultiDayAssignment,
    }),
  };
}

export function buildDismissEntitySuggestionsResult(
  pending: PendingEntityClarification,
): WriteIntentResult {
  const updated = dismissEntitySuggestions(pending);
  return {
    kind: "clarification",
    question: buildNoneOfTheseQuestion(updated.unresolvedField),
    pendingEntityClarification: updated,
    pendingCreateAppointment: updated.pendingCreateAppointment ?? undefined,
    pendingMultiDayAssignment: updated.pendingMultiDayAssignment ?? undefined,
    entitySuggestions: [],
  };
}

export function entityBelongsToBusinessContext(
  context: BrainContextSnapshot,
  entityType: EntitySuggestionType,
  entityId: string,
  liveLookup?: EntityLiveLookupCache,
): boolean {
  switch (entityType) {
    case "customer":
      return context.customerDirectory.some((entry) => entry.id === entityId);
    case "employee":
      return context.employeeDirectory.some(
        (entry) => entry.id === entityId && entry.status === "active",
      );
    case "appointment":
      return listSchedulableAppointments(context).some((entry) => entry.id === entityId);
    case "task":
      return context.overdueTasks.some((entry) => entry.id === entityId);
    case "invoice":
      return (
        context.overdueInvoices.some((entry) => entry.id === entityId) ||
        context.outstandingInvoices.some((entry) => entry.id === entityId) ||
        liveLookup?.invoices?.some((entry) => entry.id === entityId) === true
      );
    case "schedule_entry":
      return liveLookup?.scheduleEntries?.some((entry) => entry.id === entityId) === true;
    default:
      return false;
  }
}

export function prioritizePageContextSuggestion(
  suggestions: EntitySuggestion[],
  pageEntityId: string | null | undefined,
): EntitySuggestion[] {
  if (!pageEntityId) return suggestions;
  const match = suggestions.find((item) => item.entityId === pageEntityId);
  if (!match) return suggestions;
  return [match, ...suggestions.filter((item) => item.entityId !== pageEntityId)];
}

export function resumePendingEntityClarification(input: {
  pending: PendingEntityClarification;
  selectedEntityId: string;
  selectedLabel: string;
  selectedEntityType: EntitySuggestionType;
}): PendingEntityClarification {
  return applyEntitySuggestionSelection(input.pending, {
    entityType: input.selectedEntityType,
    entityId: input.selectedEntityId,
    displayName: input.selectedLabel,
  });
}

function getWriteIntentOptions(
  writeOptions?: WriteIntentParseOptions,
): {
  originalQuestion: string;
  resolvedOverrides: ResolvedEntityOverride[];
  pendingCreateAppointment?: CreateAppointmentPendingIntent | null;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent | null;
  pageContext?: ValidatedBrainPageContext | null;
  liveInvoiceDirectory?: InvoiceLookupRecord[];
  liveScheduleEntryDirectory?: ScheduleEntryLookupRecord[];
} {
  return {
    originalQuestion: writeOptions?.originalQuestion ?? "",
    resolvedOverrides: writeOptions?.resolvedEntityOverrides ?? [],
    pendingCreateAppointment: writeOptions?.pendingCreateAppointment ?? null,
    pendingMultiDayAssignment: writeOptions?.pendingMultiDayAssignment ?? null,
    pageContext: writeOptions?.pageContext ?? null,
    liveInvoiceDirectory: writeOptions?.liveInvoiceDirectory,
    liveScheduleEntryDirectory: writeOptions?.liveScheduleEntryDirectory,
  };
}

function buildClarificationInput(
  opts: ReturnType<typeof getWriteIntentOptions>,
  reference: string,
  entityType: EntitySuggestionType,
  suggestions: EntitySuggestion[],
) {
  return {
    originalQuestion: opts.originalQuestion || reference,
    reference,
    entityType,
    suggestions,
    pendingCreateAppointment: opts.pendingCreateAppointment,
    pendingMultiDayAssignment: opts.pendingMultiDayAssignment,
    resolvedOverrides: opts.resolvedOverrides,
    pageContext: opts.pageContext,
  };
}

export function resolveEmployeeForWriteIntent(
  reference: string,
  context: BrainContextSnapshot,
  writeOptions?: WriteIntentParseOptions,
  employeesOverride?: EmployeeEntity[],
):
  | { status: "resolved"; entity: EmployeeEntity }
  | { status: "needs_clarification"; result: WriteIntentResult } {
  const opts = getWriteIntentOptions(writeOptions);
  const directory = employeesOverride ?? context.employeeDirectory;
  const override = opts.resolvedOverrides.find((item) => item.field === "employee");
  if (override) {
    const entity = directory.find(
      (employee) =>
        employee.id === override.entityId && employee.status === "active",
    );
    if (entity) {
      return { status: "resolved", entity };
    }
  }

  const outcome = resolveEmployeeWithSuggestions(reference, directory);
  if (outcome.kind === "resolved") {
    return { status: "resolved", entity: outcome.entity };
  }

  if (outcome.kind === "ambiguous" || outcome.kind === "suggest") {
    return {
      status: "needs_clarification",
      result: buildEntityClarificationResult(
        buildClarificationInput(opts, reference, "employee", outcome.suggestions),
      ),
    };
  }

  return {
    status: "needs_clarification",
    result: buildNoMatchClarificationResult({
      originalQuestion: opts.originalQuestion || reference,
      reference,
      entityType: "employee",
      pendingCreateAppointment: opts.pendingCreateAppointment,
      pendingMultiDayAssignment: opts.pendingMultiDayAssignment,
      resolvedOverrides: opts.resolvedOverrides,
    }),
  };
}

export function resolveCustomerForWriteIntent(
  reference: string,
  context: BrainContextSnapshot,
  writeOptions?: WriteIntentParseOptions,
  customersOverride?: CustomerDirectoryEntry[],
):
  | { status: "resolved"; entity: CustomerDirectoryEntry }
  | { status: "needs_clarification"; result: WriteIntentResult } {
  const opts = getWriteIntentOptions(writeOptions);
  const directory = customersOverride ?? context.customerDirectory;
  const override = opts.resolvedOverrides.find((item) => item.field === "customer");
  if (override) {
    const entity = directory.find(
      (customer) => customer.id === override.entityId,
    );
    if (entity) {
      return { status: "resolved", entity };
    }
  }

  const outcome = resolveCustomerWithSuggestions(
    reference,
    directory,
  );
  if (outcome.kind === "resolved") {
    return { status: "resolved", entity: outcome.entity };
  }

  if (outcome.kind === "ambiguous" || outcome.kind === "suggest") {
    return {
      status: "needs_clarification",
      result: buildEntityClarificationResult(
        buildClarificationInput(opts, reference, "customer", outcome.suggestions),
      ),
    };
  }

  return {
    status: "needs_clarification",
    result: buildNoMatchClarificationResult({
      originalQuestion: opts.originalQuestion || reference,
      reference,
      entityType: "customer",
      pendingCreateAppointment: opts.pendingCreateAppointment,
      pendingMultiDayAssignment: opts.pendingMultiDayAssignment,
      resolvedOverrides: opts.resolvedOverrides,
    }),
  };
}

export function resolveTaskForWriteIntent(
  reference: string,
  context: BrainContextSnapshot,
  writeOptions?: WriteIntentParseOptions,
):
  | { status: "resolved"; entity: { id: string; title: string } }
  | { status: "needs_clarification"; result: WriteIntentResult } {
  const opts = getWriteIntentOptions(writeOptions);
  const override = opts.resolvedOverrides.find((item) => item.field === "task");
  if (override) {
    const entity = context.overdueTasks.find((task) => task.id === override.entityId);
    if (entity) return { status: "resolved", entity };
  }

  const tasks = context.overdueTasks.map((task) => ({
    id: task.id,
    title: task.title,
    customer: task.customer,
  }));
  const suggestions = buildTaskSuggestions(reference, tasks).filter(
    (item) => item.score >= FUZZY_MIN_SUGGESTION_SCORE,
  );

  const needle = normalizeEntityName(reference);
  const exact = tasks.filter((task) => normalizeEntityName(task.title) === needle);
  if (exact.length === 1) return { status: "resolved", entity: exact[0]! };

  const partial = tasks.filter((task) =>
    normalizeEntityName(task.title).includes(needle),
  );
  if (partial.length === 1) return { status: "resolved", entity: partial[0]! };

  if (suggestions.length > 0) {
    return {
      status: "needs_clarification",
      result: buildEntityClarificationResult(
        buildClarificationInput(opts, reference, "task", suggestions),
      ),
    };
  }

  return {
    status: "needs_clarification",
    result: buildNoMatchClarificationResult({
      originalQuestion: opts.originalQuestion || reference,
      reference,
      entityType: "task",
      resolvedOverrides: opts.resolvedOverrides,
    }),
  };
}

export function resolveAppointmentForWriteIntent(
  reference: string,
  appointments: BrainAppointmentRef[],
  writeOptions?: WriteIntentParseOptions,
):
  | { status: "resolved"; entity: BrainAppointmentRef }
  | { status: "needs_clarification"; result: WriteIntentResult } {
  const opts = getWriteIntentOptions(writeOptions);
  const override = opts.resolvedOverrides.find((item) => item.field === "appointment");
  if (override) {
    const entity = appointments.find((appointment) => appointment.id === override.entityId);
    if (entity) return { status: "resolved", entity };
  }

  const suggestions = buildAppointmentSuggestions(reference, appointments).filter(
    (item) => item.score >= FUZZY_MIN_SUGGESTION_SCORE,
  );

  const needle = normalizeEntityName(reference);
  const exact = appointments.filter(
    (appointment) =>
      normalizeEntityName(appointment.title) === needle ||
      normalizeEntityName(appointment.customer) === needle,
  );
  if (exact.length === 1) return { status: "resolved", entity: exact[0]! };

  if (suggestions.length === 1 && suggestions[0]!.score >= 0.85) {
    const entity = appointments.find((item) => item.id === suggestions[0]!.entityId);
    if (entity) return { status: "resolved", entity };
  }

  if (suggestions.length > 0) {
    return {
      status: "needs_clarification",
      result: buildEntityClarificationResult(
        buildClarificationInput(opts, reference, "appointment", suggestions),
      ),
    };
  }

  return {
    status: "needs_clarification",
    result: buildNoMatchClarificationResult({
      originalQuestion: opts.originalQuestion || reference,
      reference,
      entityType: "appointment",
      resolvedOverrides: opts.resolvedOverrides,
      pendingCreateAppointment: opts.pendingCreateAppointment,
      pendingMultiDayAssignment: opts.pendingMultiDayAssignment,
    }),
  };
}

export function resolveInvoiceForWriteIntent(
  reference: string,
  invoices: InvoiceLookupRecord[],
  writeOptions?: WriteIntentParseOptions,
):
  | { status: "resolved"; entity: InvoiceLookupRecord }
  | { status: "needs_clarification"; result: WriteIntentResult } {
  const opts = getWriteIntentOptions(writeOptions);
  const override = opts.resolvedOverrides.find((item) => item.field === "invoice");
  if (override) {
    const entity = invoices.find((invoice) => invoice.id === override.entityId);
    if (entity) return { status: "resolved", entity };
  }

  const suggestions = buildInvoiceSuggestions(reference, invoices, {
    includeTotals: true,
  }).filter((item) => item.score >= FUZZY_MIN_SUGGESTION_SCORE);

  const needle = normalizeEntityName(reference);
  const exact = invoices.filter(
    (invoice) =>
      normalizeEntityName(invoice.number) === needle ||
      normalizeEntityName(invoice.customer) === needle,
  );
  if (exact.length === 1) return { status: "resolved", entity: exact[0]! };

  if (suggestions.length > 0) {
    return {
      status: "needs_clarification",
      result: buildEntityClarificationResult(
        buildClarificationInput(opts, reference, "invoice", suggestions),
      ),
    };
  }

  return {
    status: "needs_clarification",
    result: buildNoMatchClarificationResult({
      originalQuestion: opts.originalQuestion || reference,
      reference,
      entityType: "invoice",
      resolvedOverrides: opts.resolvedOverrides,
    }),
  };
}

export function resolveScheduleEntryForWriteIntent(
  reference: string,
  entries: ScheduleEntryLookupRecord[],
  writeOptions?: WriteIntentParseOptions,
):
  | { status: "resolved"; entity: ScheduleEntryLookupRecord }
  | { status: "needs_clarification"; result: WriteIntentResult } {
  const opts = getWriteIntentOptions(writeOptions);
  const override = opts.resolvedOverrides.find((item) => item.field === "schedule_entry");
  if (override) {
    const entity = entries.find((entry) => entry.id === override.entityId);
    if (entity) return { status: "resolved", entity };
  }

  const suggestions = buildScheduleEntrySuggestions(reference, entries).filter(
    (item) => item.score >= FUZZY_MIN_SUGGESTION_SCORE,
  );

  const needle = normalizeEntityName(reference);
  const exact = entries.filter(
    (entry) => normalizeEntityName(entry.title) === needle,
  );
  if (exact.length === 1) return { status: "resolved", entity: exact[0]! };

  if (suggestions.length > 0) {
    return {
      status: "needs_clarification",
      result: buildEntityClarificationResult(
        buildClarificationInput(opts, reference, "schedule_entry", suggestions),
      ),
    };
  }

  return {
    status: "needs_clarification",
    result: buildNoMatchClarificationResult({
      originalQuestion: opts.originalQuestion || reference,
      reference,
      entityType: "schedule_entry",
      resolvedOverrides: opts.resolvedOverrides,
    }),
  };
}

export function mergeResolvedOverride(
  overrides: ResolvedEntityOverride[],
  selection: ResolvedEntityOverride,
): ResolvedEntityOverride[] {
  return [
    ...overrides.filter((item) => item.field !== selection.field),
    selection,
  ];
}
