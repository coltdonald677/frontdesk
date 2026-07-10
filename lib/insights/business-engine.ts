import { loadBusinessInsightContext } from "./context";
import { BUSINESS_INSIGHT_RULES } from "./business-rules";
import type { BusinessInsight, BusinessInsightProvider } from "./business-types";
import { sortBusinessInsights } from "./business-types";

export class RuleBasedBusinessInsightProvider implements BusinessInsightProvider {
  constructor(private readonly rules = BUSINESS_INSIGHT_RULES) {}

  generate(context: Awaited<ReturnType<typeof loadBusinessInsightContext>>) {
    const insights = this.rules.flatMap((rule) => rule(context));
    return sortBusinessInsights(insights);
  }
}

let activeBusinessProvider: BusinessInsightProvider =
  new RuleBasedBusinessInsightProvider();

export function setBusinessInsightProvider(provider: BusinessInsightProvider) {
  activeBusinessProvider = provider;
}

export function getBusinessInsightProvider() {
  return activeBusinessProvider;
}

export async function getBusinessInsights(
  businessProfileId: string,
): Promise<BusinessInsight[]> {
  const context = await loadBusinessInsightContext(businessProfileId);
  return getBusinessInsightProvider().generate(context);
}

export function hasBusinessIssues(insights: BusinessInsight[]) {
  return insights.some(
    (insight) => insight.severity === "red" || insight.severity === "yellow",
  );
}
