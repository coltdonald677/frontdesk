import { loadRecommendationContext } from "./context";
import { RECOMMENDATION_RULES } from "./rules";
import type {
  PlutoRecommendation,
  RecommendationContext,
  RecommendationRule,
} from "./types";
import { SEVERITY_RANK } from "./types";

export type RecommendationsProvider = {
  id: string;
  generate: (
    context: RecommendationContext,
  ) => PlutoRecommendation[] | Promise<PlutoRecommendation[]>;
};

export function sortRecommendations(
  recommendations: PlutoRecommendation[],
): PlutoRecommendation[] {
  return [...recommendations].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}

export class RuleBasedRecommendationsProvider implements RecommendationsProvider {
  id = "rules-v1";

  constructor(private rules: RecommendationRule[] = RECOMMENDATION_RULES) {}

  generate(context: RecommendationContext) {
    return sortRecommendations(this.rules.flatMap((rule) => rule(context)));
  }
}

const defaultProvider = new RuleBasedRecommendationsProvider();

export function getRecommendationsProvider() {
  return defaultProvider;
}

export async function getPlutoRecommendations(
  businessProfileId: string,
  provider: RecommendationsProvider = defaultProvider,
): Promise<PlutoRecommendation[]> {
  const context = await loadRecommendationContext(businessProfileId);
  return provider.generate(context);
}
