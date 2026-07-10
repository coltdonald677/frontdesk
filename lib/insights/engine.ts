import { loadInsightContext } from "./context";
import { INSIGHT_RULES } from "./rules";
import type { CommandCenterInsight, InsightProvider } from "./types";
import { sortInsights } from "./types";

export class RuleBasedInsightProvider implements InsightProvider {
  constructor(
    private readonly rules = INSIGHT_RULES,
  ) {}

  generate(context: Awaited<ReturnType<typeof loadInsightContext>>) {
    const insights = this.rules.flatMap((rule) => rule(context));
    return sortInsights(insights);
  }
}

let activeProvider: InsightProvider = new RuleBasedInsightProvider();

export function setInsightProvider(provider: InsightProvider) {
  activeProvider = provider;
}

export function getInsightProvider() {
  return activeProvider;
}

export async function getCommandCenterInsights(
  businessProfileId: string,
): Promise<CommandCenterInsight[]> {
  const context = await loadInsightContext(businessProfileId);
  return getInsightProvider().generate(context);
}

export type { CommandCenterInsight, InsightPriority, InsightKind, InsightIcon } from "./types";
export type { InsightContext } from "./context";
