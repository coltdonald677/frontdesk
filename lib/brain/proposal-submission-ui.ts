import { buildActionDisplayFields } from "@/lib/brain/action-display";
import type { BrainSuggestedAction } from "@/lib/brain/types";

export type ProposalCardView = "proposal" | "confirm" | "success" | "dismissed";

export type ProposalSubmissionSummary = {
  entryCount: string | null;
  totalHours: string | null;
};

export function getProposalSubmissionSummary(
  action: BrainSuggestedAction,
): ProposalSubmissionSummary {
  const fields = buildActionDisplayFields(action);
  return {
    entryCount: fields.find((field) => field.label === "Number of entries")?.value ?? null,
    totalHours: fields.find((field) => field.label === "Total hours")?.value ?? null,
  };
}

export function getCompactConfirmFields(action: BrainSuggestedAction): Array<{
  label: string;
  value: string;
}> {
  const fields = buildActionDisplayFields(action);
  const keepLabels = new Set([
    "Employee",
    "Customer",
    "Start date",
    "End date",
    "Number of entries",
    "Hours per day",
    "Total hours",
    "Weekends included",
  ]);

  const compact = fields.filter((field) => keepLabels.has(field.label));
  return compact.length > 0
    ? compact.map((field) => ({ label: field.label, value: field.value }))
    : fields.slice(0, 6).map((field) => ({ label: field.label, value: field.value }));
}
